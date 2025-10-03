import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

// Helper function for making requests
async function makeRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    console.log(`${options.method || 'GET'} ${endpoint}:`, response.status, data);
    return { status: response.status, data };
  } catch (error) {
    console.error(`Error en ${endpoint}:`, error.message);
    return { error: error.message };
  }
}

async function testAPI() {
  console.log('🚀 Iniciando pruebas de la API...\n');

  // 1. Health check
  console.log('1. Health Check');
  await makeRequest('/health');
  console.log('');

  // 2. User Registration
  console.log('2. User Registration');
  const registerResult = await makeRequest('/api/user/register', {
    method: 'POST',
    body: JSON.stringify({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123'
    })
  });
  console.log('');

  // 3. Login
  console.log('3. User Login');
  const loginResult = await makeRequest('/api/user/login', {
    method: 'POST',
    body: JSON.stringify({
      username: 'testuser',
      password: 'password123'
    })
  });

  if (loginResult.status !== 200) {
    console.log('❌ Login failed, ending tests');
    return;
  }

  const token = loginResult.data.token;
  console.log('✅ Token obtenido:', token.substring(0, 20) + '...');
  console.log('');

  // 4. Get profile
  console.log('4. Get Profile');
  await makeRequest('/api/user/profile', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  console.log('');

  // 5. Agregar torrent
  console.log('5. Agregar Torrent');
  const addTorrentResult = await makeRequest('/api/torrent', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      infoHash: 'abc123def456789012345678901234567890abcd',
      name: 'Test Torrent',
      category: 'Test',
      tags: 'test, example'
    })
  });
  console.log('');

  // 6. Get torrent
  if (addTorrentResult.status === 201) {
    console.log('6. Get Torrent');
    await makeRequest('/api/torrent/abc123def456789012345678901234567890abcd', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('');
  }

  // 7. Listar IP bans
  console.log('7. Listar IP Bans');
  await makeRequest('/api/ipban', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  console.log('');

  // 8. Agregar IP ban
  console.log('8. Agregar IP Ban');
  await makeRequest('/api/ipban', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      fromIP: '192.168.1.1',
      toIP: '192.168.1.255',
      reason: 'Test ban'
    })
  });
  console.log('');

  // 9. Metrics
  console.log('9. Prometheus Metrics');
  const metricsResponse = await fetch(`${BASE_URL}/metrics`);
  const metrics = await metricsResponse.text();
  console.log('Metrics obtained:', metrics.split('\n').length, 'lines');
  console.log('');

  console.log('✅ Tests completed');
}

// Execute tests only if file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testAPI().catch(console.error);
}

export { testAPI };