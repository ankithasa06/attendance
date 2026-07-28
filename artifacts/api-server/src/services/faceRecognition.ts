import * as faceapi from '@vladmandic/face-api';
import * as tf from '@tensorflow/tfjs';
import { Canvas, Image, ImageData, loadImage } from '@napi-rs/canvas';
import path from 'path';

// Wrapper to prevent undefined arguments which crashes @napi-rs/canvas
class SafeCanvas extends Canvas {
  constructor(width = 300, height = 300) {
    super(width || 300, height || 300);
  }
}

// Monkey patch face-api with napi-rs/canvas
// @ts-ignore
faceapi.env.monkeyPatch({ Canvas: SafeCanvas, Image, ImageData });

let modelsLoaded = false;

export async function loadModels() {
  if (modelsLoaded) return;
  
  // The models are in node_modules/@vladmandic/face-api/model
  const modelPath = path.join(process.cwd(), 'node_modules', '@vladmandic/face-api', 'model');
  
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromDisk(modelPath),
      faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath),
      faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath)
    ]);
    modelsLoaded = true;
    console.log('Face API models loaded successfully.');
  } catch (error) {
    console.error('Failed to load Face API models:', error);
    throw error;
  }
}

/**
 * Extracts a 128D face descriptor from an image buffer
 */
const MAX_INPUT_SIZE = 320; // scale images down for faster inference

export async function getFaceDescriptor(imageBuffer: Buffer): Promise<Float32Array | null> {
  if (!modelsLoaded) {
    await loadModels();
  }

  try {
    const img = await loadImage(imageBuffer);

    // Scale down to MAX_INPUT_SIZE to dramatically speed up inference
    const scale = Math.min(1, MAX_INPUT_SIZE / Math.max(img.width, img.height));
    const w = Math.round(img.width  * scale);
    const h = Math.round(img.height * scale);

    const canvas = new Canvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    // inputSize: 160 is the smallest valid option — fastest inference, still accurate
    const detection = await faceapi
      .detectSingleFace(canvas as any, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return null;
    return detection.descriptor;
  } catch (error) {
    console.error('Error getting face descriptor:', error);
    return null;
  }
}

/**
 * Compares two face descriptors and returns the Euclidean distance.
 * Lower distance means higher similarity.
 * Typically, distance < 0.6 is considered a match.
 */
export function getFaceDistance(desc1: Float32Array | number[], desc2: Float32Array | number[]): number {
  return faceapi.euclideanDistance(
    desc1 instanceof Float32Array ? desc1 : new Float32Array(desc1),
    desc2 instanceof Float32Array ? desc2 : new Float32Array(desc2)
  );
}

/**
 * Checks if a face descriptor matches any in a list of registered descriptors.
 */
export function findBestMatch(descriptor: Float32Array | number[], registeredDescriptors: number[][], threshold = 0.5): boolean {
  if (registeredDescriptors.length === 0) return false;
  
  let bestDistance = 1.0;
  for (const regDesc of registeredDescriptors) {
    const distance = getFaceDistance(descriptor, regDesc);
    if (distance < bestDistance) {
      bestDistance = distance;
    }
  }
  
  return bestDistance <= threshold;
}
