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

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(JSON.stringify({
  employeeId: 1,
  latitude: 0,
  longitude: 0,
  attendanceType: "office",
  locationId: 1
}));
req.end();
