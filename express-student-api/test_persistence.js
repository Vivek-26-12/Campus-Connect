const http = require('http');

const request = (method, path, body = null) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '127.0.0.1',
            port: 3000,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
};

const main = async () => {
    const action = process.argv[2];

    if (action === 'add') {
        const res = await request('POST', '/students', {
            name: "Persistent Student",
            email: "persistent.student@example.com",
            course: "Database Systems",
            semester: 5
        });
        console.log(`[Persistence Step 1] Added student:`, res.body);
    } else if (action === 'verify') {
        const res = await request('GET', '/students');
        const found = res.body.find(s => s.email === "persistent.student@example.com");
        console.log(`[Persistence Step 2] Verified across restart! Found student:`, found ? "YES (ID " + found.id + ", Name: " + found.name + ")" : "NO");
        if (!found) process.exit(1);
    }
};

main().catch(err => {
    console.error(err);
    process.exit(1);
});
