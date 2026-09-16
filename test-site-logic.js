const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/attendance/check-in',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

const payload = {
  employeeId: 1,
  latitude: 10.0,
  longitude: 20.0,
  attendanceType: "site",
  faceImageBase64: "data:image/jpeg;base64,mockbase64"
};

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  let data = '';
  res.on('data', d => {
    data += d;
  });
  res.on('end', () => {
    console.log("Response:", data);
  });
});

req.on('error', error => {
  console.error(error);
});

// We need a valid session to avoid 401. 
// We will mock the database call by directly executing the logic.
req.write(JSON.stringify(payload));
req.end();
