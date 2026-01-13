const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API = 'http://localhost:5000';
let testResults = [];

// Helper function to make requests
async function request(method, endpoint, data = null, token = null) {
    try {
        const config = {
            method,
            url: `${API}${endpoint}`,
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        };

        if (data) {
            if (data instanceof FormData) {
                config.data = data;
                config.headers = { ...config.headers, ...data.getHeaders() };
            } else {
                config.data = data;
                config.headers = { ...config.headers, 'Content-Type': 'application/json' };
            }
        }

        const response = await axios(config);
        return { success: true, status: response.status, data: response.data };
    } catch (error) {
        return {
            success: false,
            status: error.response?.status || 'ERROR',
            message: error.response?.data?.message || error.message,
            data: error.response?.data
        };
    }
}

// Test helper
function test(name, passed, expected, actual) {
    const result = {
        test: name,
        status: passed ? '✅ PASS' : '❌ FAIL',
        expected,
        actual
    };
    testResults.push(result);
    console.log(`${result.status} - ${name}`);
    if (!passed) {
        console.log(`   Expected: ${expected}`);
        console.log(`   Actual: ${actual}`);
    }
}

async function runTests() {
    console.log('\n🚀 SHARE FEATURE TEST SUITE\n');
    console.log('='.repeat(70));

    let ownerToken, requesterToken, editor2Token, deniedToken;
    let fileId, requestId1, requestId2, requestId3;

    // ============ PHASE 1: USER CREATION ============
    console.log('\n📝 PHASE 1: Creating Test Users');
    console.log('-'.repeat(70));

    // Create Owner
    let res = await request('POST', '/auth/signup', {
        email: `owner${Date.now()}@test.com`,
        password: 'password123'
    });
    test('Create Owner User', res.success && res.status === 200, 'Status 200', res.status);
    if (res.success) ownerToken = res.data.token;

    // Create Requester
    res = await request('POST', '/auth/signup', {
        email: `requester${Date.now()}@test.com`,
        password: 'password123'
    });
    test('Create Requester User', res.success && res.status === 200, 'Status 200', res.status);
    if (res.success) requesterToken = res.data.token;

    // Create Editor
    res = await request('POST', '/auth/signup', {
        email: `editor${Date.now()}@test.com`,
        password: 'password123'
    });
    test('Create Editor User', res.success && res.status === 200, 'Status 200', res.status);
    if (res.success) editor2Token = res.data.token;

    // Create Denied User
    res = await request('POST', '/auth/signup', {
        email: `denied${Date.now()}@test.com`,
        password: 'password123'
    });
    test('Create Denied User', res.success && res.status === 200, 'Status 200', res.status);
    if (res.success) deniedToken = res.data.token;

    // ============ PHASE 2: FILE UPLOAD ============
    console.log('\n📤 PHASE 2: File Upload');
    console.log('-'.repeat(70));

    // Create a test file
    const testFilePath = path.join(__dirname, 'test-file.txt');
    fs.writeFileSync(testFilePath, 'Test file content for share feature testing');

    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath));

    res = await request('POST', '/files/upload', form, ownerToken);
    test('Upload File', res.success && res.status === 200 && res.data._id, 'File uploaded with ID', res.status);
    if (res.success && res.data._id) fileId = res.data._id;

    // ============ PHASE 3: SHARE REQUEST (VIEW) ============
    console.log('\n📬 PHASE 3: Create Share Request (VIEW Permission)');
    console.log('-'.repeat(70));

    res = await request('POST', `/files/share/${fileId}/request`, { permission: 'view' }, requesterToken);
    test('Create Share Request', res.success && res.status === 200, 'Status 200', res.status);
    test('Request Status is Pending', res.success && res.data.request?.status === 'pending', 'pending', res.data.request?.status);
    test('Permission Requested is View', res.success && res.data.request?.permissionRequested === 'view', 'view', res.data.request?.permissionRequested);
    if (res.success && res.data.request?._id) requestId1 = res.data.request._id;

    // Test Duplicate Prevention
    res = await request('POST', `/files/share/${fileId}/request`, { permission: 'view' }, requesterToken);
    test('Duplicate Prevention', !res.success && res.status === 400, 'Status 400', res.status);
    test('Duplicate Error Message', !res.success && res.data.message.includes('already pending'), 'contains "already pending"', res.data?.message);

    // Test Invalid Permission
    res = await request('POST', `/files/share/${fileId}/request`, { permission: 'admin' }, editor2Token);
    test('Invalid Permission Validation', !res.success && res.status === 400, 'Status 400', res.status);
    test('Invalid Permission Error', !res.success && res.data.message.includes('view or edit'), 'contains "view or edit"', res.data?.message);

    // ============ PHASE 4: VIEW PENDING REQUESTS ============
    console.log('\n👀 PHASE 4: View Pending Requests');
    console.log('-'.repeat(70));

    res = await request('GET', `/files/share/${fileId}/requests`, null, ownerToken);
    test('Get Pending Requests', res.success && res.status === 200, 'Status 200', res.status);
    test('Requests Array Returned', res.success && Array.isArray(res.data), 'is array', Array.isArray(res.data));
    test('At Least One Request', res.success && res.data.length >= 1, 'length >= 1', res.data?.length);

    // ============ PHASE 5: APPROVE REQUEST ============
    console.log('\n✅ PHASE 5: Approve Request');
    console.log('-'.repeat(70));

    res = await request('POST', `/files/share/${fileId}/respond`, {
        requestId: requestId1,
        action: 'approve',
        permission: 'view'
    }, ownerToken);
    test('Approve Request', res.success && res.status === 200, 'Status 200', res.status);
    test('Shared With Updated', res.success && res.data.file?.sharedWith?.length > 0, 'sharedWith has items', res.data.file?.sharedWith?.length);
    test('User Has View Permission', res.success && res.data.file?.sharedWith?.[0]?.permission === 'view', 'view', res.data.file?.sharedWith?.[0]?.permission);

    // ============ PHASE 6: VERIFY ACCESS ============
    console.log('\n🔓 PHASE 6: Verify Access');
    console.log('-'.repeat(70));

    res = await request('GET', `/files/share/${fileId}/status`, null, requesterToken);
    test('Check Request Status', res.success && res.status === 200, 'Status 200', res.status);
    test('Status is Approved', res.success && res.data.status === 'approved', 'approved', res.data?.status);

    res = await request('GET', `/files/${fileId}`, null, requesterToken);
    test('Download Approved File', res.success && res.status === 200, 'Status 200', res.status);

    // ============ PHASE 7: EDIT PERMISSION ============
    console.log('\n🖊️  PHASE 7: Test EDIT Permission');
    console.log('-'.repeat(70));

    res = await request('POST', `/files/share/${fileId}/request`, { permission: 'edit' }, editor2Token);
    test('Request Edit Permission', res.success && res.status === 200, 'Status 200', res.status);
    test('Edit Permission Requested', res.success && res.data.request?.permissionRequested === 'edit', 'edit', res.data.request?.permissionRequested);
    if (res.success && res.data.request?._id) requestId2 = res.data.request._id;

    res = await request('POST', `/files/share/${fileId}/respond`, {
        requestId: requestId2,
        action: 'approve',
        permission: 'edit'
    }, ownerToken);
    test('Approve Edit Permission', res.success && res.status === 200, 'Status 200', res.status);
    test('Edit Permission Granted', res.success && res.data.file?.sharedWith?.some(s => s.permission === 'edit'), 'has edit', res.data.file?.sharedWith?.some(s => s.permission === 'edit'));

    // ============ PHASE 8: REJECTION ============
    console.log('\n❌ PHASE 8: Test Rejection');
    console.log('-'.repeat(70));

    res = await request('POST', `/files/share/${fileId}/request`, { permission: 'view' }, deniedToken);
    test('Create Request for Rejection', res.success && res.status === 200, 'Status 200', res.status);
    if (res.success && res.data.request?._id) requestId3 = res.data.request._id;

    res = await request('POST', `/files/share/${fileId}/respond`, {
        requestId: requestId3,
        action: 'reject'
    }, ownerToken);
    test('Reject Request', res.success && res.status === 200, 'Status 200', res.status);
    test('Rejection Message', res.success && res.data.message === 'Rejected', 'Rejected', res.data?.message);

    // ============ PHASE 9: ERROR SCENARIOS ============
    console.log('\n⚠️  PHASE 9: Error Scenarios');
    console.log('-'.repeat(70));

    // Owner cannot request own file
    res = await request('POST', `/files/share/${fileId}/request`, { permission: 'view' }, ownerToken);
    test('Owner Cannot Request Own File', !res.success && res.status === 400, 'Status 400', res.status);
    test('Owner Error Message', !res.success && res.data.message.includes('Owner already'), 'contains "Owner already"', res.data?.message);

    // Non-owner cannot approve
    res = await request('POST', `/files/share/${fileId}/respond`, {
        requestId: requestId1,
        action: 'approve'
    }, requesterToken);
    test('Non-Owner Cannot Approve', !res.success && res.status === 403, 'Status 403', res.status);
    test('Non-Owner Error', !res.success && res.data.message.includes('Only owner'), 'contains "Only owner"', res.data?.message);

    // Cannot respond to non-existent request
    res = await request('POST', `/files/share/${fileId}/respond`, {
        requestId: 'invalid_id',
        action: 'approve'
    }, ownerToken);
    test('Non-Existent Request Error', !res.success && res.status === 404, 'Status 404', res.status);

    // ============ SUMMARY ============
    console.log('\n' + '='.repeat(70));
    console.log('\n📊 TEST SUMMARY\n');

    const passed = testResults.filter(r => r.status.includes('✅')).length;
    const failed = testResults.filter(r => r.status.includes('❌')).length;
    const total = testResults.length;

    testResults.forEach(r => {
        console.log(`${r.status} ${r.test}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log(`\n📈 Results: ${passed}/${total} PASSED, ${failed}/${total} FAILED\n`);

    if (failed === 0) {
        console.log('🎉 ALL TESTS PASSED! Share feature is working correctly!\n');
    } else {
        console.log(`⚠️  ${failed} test(s) failed. Review the results above.\n`);
    }

    // Cleanup
    fs.unlinkSync(testFilePath);
}

// Run tests
runTests().catch(err => {
    console.error('Test suite error:', err.message);
    process.exit(1);
});
