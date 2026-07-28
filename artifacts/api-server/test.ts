import { loadModels } from './src/services/faceRecognition';
import { resolve } from 'path';

async function run() {
  try {
    console.log("CWD:", process.cwd());
    await loadModels();
    console.log("Successfully loaded models!");
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
