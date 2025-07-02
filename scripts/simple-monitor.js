/**
 * 简化版部署监控脚本
 */

import https from 'https';

const WORKERS_URL = 'https://vps-monitor-api.gp96123.workers.dev';

function checkWorkers() {
  return new Promise((resolve, reject) => {
    console.log('🔍 检查Workers状态...');
    
    const req = https.get(`${WORKERS_URL}/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`✅ Workers响应: ${res.statusCode}`);
        console.log(`📄 内容: ${data}`);
        resolve({ status: res.statusCode, body: data });
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Workers检查失败:', error.message);
      reject(error);
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
  });
}

async function main() {
  console.log('🚀 开始检查VPS Monitor部署状态...\n');
  
  try {
    const result = await checkWorkers();
    
    if (result.status === 200) {
      console.log('\n🎉 Workers部署成功！API正常响应。');
      
      // 显示Workers信息
      console.log('\n📊 部署信息:');
      console.log(`🌐 Workers URL: ${WORKERS_URL}`);
      console.log(`✅ 健康检查: 通过`);
      console.log(`📡 API状态: 正常`);
      
    } else {
      console.log(`\n⚠️ Workers响应异常，状态码: ${result.status}`);
    }
    
  } catch (error) {
    console.error('\n❌ 检查失败:', error.message);
    console.log('\n🔧 可能的解决方案:');
    console.log('1. 检查网络连接');
    console.log('2. 确认Workers已正确部署');
    console.log('3. 检查Cloudflare服务状态');
  }
}

main().catch(console.error);
