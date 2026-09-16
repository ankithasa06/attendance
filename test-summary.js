async function run() {
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@xpredict.com', password: 'password123' }) // Assuming admin exists, or we use another
    });
    const cookie = loginRes.headers.get('set-cookie');
    console.log("Logged in:", loginRes.status);

    const res = await fetch('http://localhost:5000/api/leaves/summary', {
      method: 'GET',
      headers: { 
        'Cookie': cookie
      }
    });
    
    if (res.ok) {
      console.log("Summary success:", await res.json());
    } else {
      console.error("Summary error:", res.status, await res.text());
    }
  } catch (err) {
    console.error("Failed:", err.message);
  }
}
run();
