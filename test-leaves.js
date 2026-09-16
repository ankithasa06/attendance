async function run() {
  try {
    // Login
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@xpredict.com', password: 'password123' })
    });
    const cookie = loginRes.headers.get('set-cookie');
    console.log("Logged in:", loginRes.status);

    if (!cookie) {
       console.log(await loginRes.text());
    }

    // Request LOP Leave
    const res = await fetch('http://localhost:5000/api/leaves', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': cookie
      },
      body: JSON.stringify({
        startDate: '2026-08-05',
        endDate: '2026-08-10',
        reason: 'Test LOP',
        leaveType: 'loss_of_pay',
        days: 5
      })
    });
    
    if (res.ok) {
      console.log("LOP leave success:", await res.json());
    } else {
      console.error("LOP leave error:", await res.text());
    }

  } catch (err) {
    console.error("Failed:", err.message);
  }
}

run();
