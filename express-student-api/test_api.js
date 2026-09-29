const http = require('http');

const request = (method, path, body = null) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '127.0.0.1',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : null;
                    resolve({ status: res.statusCode, body: parsed, raw: data });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data, raw: data });
                }
            });
        });

        req.on('error', reject);
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
};

const runTests = async () => {
    console.log("=== Starting Automated Test Suite for Express Student API ===");

    // Test 1: GET /students
    const res1 = await request('GET', '/students');
    console.log(`[Test 1] GET /students -> Status: ${res1.status}, Count: ${res1.body.length}`);
    if (res1.status !== 200) throw new Error("Test 1 Failed");

    // Test 2: POST /students (Create valid student)
    const uniqueEmail = `test_${Date.now()}@example.com`;
    const res2 = await request('POST', '/students', {
        name: "Dev Patel",
        email: uniqueEmail,
        course: "Cloud Computing",
        semester: 4
    });
    console.log(`[Test 2] POST /students -> Status: ${res2.status}, Created ID: ${res2.body.id}`);
    if (res2.status !== 201) throw new Error("Test 2 Failed");
    const createdId = res2.body.id;

    // Test 3: POST /students with DUPLICATE email -> Expect 400 Bad Request
    const res3 = await request('POST', '/students', {
        name: "Duplicate User",
        email: uniqueEmail,
        course: "Cloud Computing",
        semester: 4
    });
    console.log(`[Test 3] Duplicate Email -> Status: ${res3.status} (Expected 400), Message: "${res3.body.message}"`);
    if (res3.status !== 400) throw new Error("Test 3 Failed - Should reject duplicate email with 400");

    // Test 4: POST /students with INVALID body -> Expect 400 Bad Request
    const res4 = await request('POST', '/students', {
        name: "",
        email: "not-an-email",
        course: "",
        semester: -2
    });
    console.log(`[Test 4] Invalid input -> Status: ${res4.status} (Expected 400), Errors count: ${res4.body.errors ? res4.body.errors.length : 0}`);
    if (res4.status !== 400) throw new Error("Test 4 Failed - Should reject invalid fields with 400");

    // Test 5: GET /students/:id (Existing) -> Expect 200 OK
    const res5 = await request('GET', `/students/${createdId}`);
    console.log(`[Test 5] GET /students/${createdId} -> Status: ${res5.status}, Name: ${res5.body.name}`);
    if (res5.status !== 200) throw new Error("Test 5 Failed");

    // Test 6: GET /students/999 (Missing ID) -> Expect 404 Not Found
    const res6 = await request('GET', '/students/999');
    console.log(`[Test 6] GET /students/999 -> Status: ${res6.status} (Expected 404), Message: "${res6.body.message}"`);
    if (res6.status !== 404) throw new Error("Test 6 Failed - Should return 404 for missing ID");

    // Test 7: PUT /students/:id -> Expect 200 OK
    const res7 = await request('PUT', `/students/${createdId}`, {
        name: "Dev Patel Updated",
        course: "Advanced Cloud Architecture",
        semester: 5
    });
    console.log(`[Test 7] PUT /students/${createdId} -> Status: ${res7.status}, Updated Course: ${res7.body.course}`);
    if (res7.status !== 200) throw new Error("Test 7 Failed");

    // Test 8: DELETE /students/:id -> Expect 204 No Content
    const res8 = await request('DELETE', `/students/${createdId}`);
    console.log(`[Test 8] DELETE /students/${createdId} -> Status: ${res8.status} (Expected 204)`);
    if (res8.status !== 204) throw new Error("Test 8 Failed");

    // Test 9: GET /students/:id after delete -> Expect 404 Not Found
    const res9 = await request('GET', `/students/${createdId}`);
    console.log(`[Test 9] GET deleted student -> Status: ${res9.status} (Expected 404)`);
    if (res9.status !== 404) throw new Error("Test 9 Failed");

    console.log("=== All API Unit Tests Passed Successfully! ===");
};

runTests().catch(err => {
    console.error("Test Suite Failed:", err);
    process.exit(1);
});
