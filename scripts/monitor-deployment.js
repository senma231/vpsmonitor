#!/usr/bin/env node

/**
 * 部署监控脚本
 * 监控Cloudflare Workers和Pages的部署状态
 */

import https from 'https';
import { execSync } from 'child_process';

// 配置
const CONFIG = {
  WORKERS_URL: 'https://vps-monitor-api.gp96123.workers.dev',
  GITHUB_REPO: 'senma231/vpsmonitor',
  CHECK_INTERVAL: 30000, // 30秒
  MAX_RETRIES: 10
};

/**
 * HTTP请求工具
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          };
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * 检查Workers状态
 */
async function checkWorkersStatus() {
  try {
    console.log('🔍 检查Workers状态...');
    
    // 健康检查
    const healthResponse = await makeRequest(`${CONFIG.WORKERS_URL}/health`);
    console.log(`✅ Health Check: ${healthResponse.statusCode} - ${healthResponse.body}`);
    
    // API测试
    const apiResponse = await makeRequest(`${CONFIG.WORKERS_URL}/api/config`);
    console.log(`📡 API Test: ${apiResponse.statusCode}`);
    
    // 数据库测试
    const dbResponse = await makeRequest(`${CONFIG.WORKERS_URL}/api/servers`);
    console.log(`🗄️ Database Test: ${dbResponse.statusCode}`);
    
    return {
      health: healthResponse.statusCode === 200,
      api: apiResponse.statusCode === 200,
      database: dbResponse.statusCode === 200
    };
    
  } catch (error) {
    console.error('❌ Workers检查失败:', error.message);
    return {
      health: false,
      api: false,
      database: false,
      error: error.message
    };
  }
}

/**
 * 检查GitHub Actions状态
 */
async function checkGitHubActions() {
  try {
    console.log('🔍 检查GitHub Actions状态...');
    
    const response = await makeRequest(
      `https://api.github.com/repos/${CONFIG.GITHUB_REPO}/actions/runs?per_page=1`,
      {
        headers: {
          'User-Agent': 'VPS-Monitor-Deploy-Script',
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    if (response.statusCode === 200) {
      const data = JSON.parse(response.body);
      const latestRun = data.workflow_runs[0];
      
      if (latestRun) {
        console.log(`📋 最新运行: ${latestRun.name}`);
        console.log(`📊 状态: ${latestRun.status} - ${latestRun.conclusion}`);
        console.log(`🕐 时间: ${latestRun.created_at}`);
        
        return {
          status: latestRun.status,
          conclusion: latestRun.conclusion,
          name: latestRun.name,
          url: latestRun.html_url
        };
      }
    }
    
    return { status: 'unknown' };
    
  } catch (error) {
    console.error('❌ GitHub Actions检查失败:', error.message);
    return { status: 'error', error: error.message };
  }
}

/**
 * 检查Wrangler状态
 */
function checkWranglerStatus() {
  try {
    console.log('🔍 检查Wrangler状态...');
    
    // 检查登录状态
    const whoami = execSync('wrangler whoami', { encoding: 'utf8', cwd: './workers' });
    console.log('✅ Wrangler已登录');
    
    // 检查Workers列表
    const list = execSync('wrangler list', { encoding: 'utf8', cwd: './workers' });
    console.log('📋 Workers列表获取成功');
    
    return {
      loggedIn: true,
      canList: true
    };
    
  } catch (error) {
    console.error('❌ Wrangler检查失败:', error.message);
    return {
      loggedIn: false,
      canList: false,
      error: error.message
    };
  }
}

/**
 * 生成部署报告
 */
function generateReport(workersStatus, actionsStatus, wranglerStatus) {
  const timestamp = new Date().toISOString();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 VPS Monitor 部署状态报告');
  console.log('='.repeat(60));
  console.log(`🕐 检查时间: ${timestamp}`);
  console.log('');
  
  // Workers状态
  console.log('⚡ Cloudflare Workers:');
  console.log(`   健康检查: ${workersStatus.health ? '✅' : '❌'}`);
  console.log(`   API接口: ${workersStatus.api ? '✅' : '❌'}`);
  console.log(`   数据库: ${workersStatus.database ? '✅' : '❌'}`);
  if (workersStatus.error) {
    console.log(`   错误: ${workersStatus.error}`);
  }
  console.log('');
  
  // GitHub Actions状态
  console.log('🔄 GitHub Actions:');
  console.log(`   状态: ${actionsStatus.status}`);
  if (actionsStatus.conclusion) {
    console.log(`   结果: ${actionsStatus.conclusion}`);
  }
  if (actionsStatus.url) {
    console.log(`   链接: ${actionsStatus.url}`);
  }
  console.log('');
  
  // Wrangler状态
  console.log('🛠️ Wrangler CLI:');
  console.log(`   登录状态: ${wranglerStatus.loggedIn ? '✅' : '❌'}`);
  console.log(`   列表权限: ${wranglerStatus.canList ? '✅' : '❌'}`);
  console.log('');
  
  // 总体状态
  const overallHealth = workersStatus.health && workersStatus.api;
  console.log(`🎯 总体状态: ${overallHealth ? '✅ 正常' : '❌ 异常'}`);
  console.log('='.repeat(60));
  
  return {
    timestamp,
    workers: workersStatus,
    actions: actionsStatus,
    wrangler: wranglerStatus,
    overall: overallHealth
  };
}

/**
 * 主监控循环
 */
async function monitorDeployment() {
  console.log('🚀 开始监控VPS Monitor部署状态...\n');
  
  let retryCount = 0;
  
  while (retryCount < CONFIG.MAX_RETRIES) {
    try {
      // 并行检查所有状态
      const [workersStatus, actionsStatus, wranglerStatus] = await Promise.all([
        checkWorkersStatus(),
        checkGitHubActions(),
        Promise.resolve(checkWranglerStatus())
      ]);
      
      // 生成报告
      const report = generateReport(workersStatus, actionsStatus, wranglerStatus);
      
      // 如果一切正常，结束监控
      if (report.overall) {
        console.log('\n🎉 部署监控完成！所有服务正常运行。');
        break;
      }
      
      // 如果有问题，等待后重试
      retryCount++;
      if (retryCount < CONFIG.MAX_RETRIES) {
        console.log(`\n⏳ 等待 ${CONFIG.CHECK_INTERVAL/1000} 秒后重试... (${retryCount}/${CONFIG.MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, CONFIG.CHECK_INTERVAL));
      }
      
    } catch (error) {
      console.error('❌ 监控过程出错:', error.message);
      retryCount++;
      
      if (retryCount < CONFIG.MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.CHECK_INTERVAL));
      }
    }
  }
  
  if (retryCount >= CONFIG.MAX_RETRIES) {
    console.log('\n⚠️ 达到最大重试次数，监控结束。');
    console.log('请手动检查部署状态或查看日志。');
  }
}

/**
 * 错误处理
 */
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
  process.exit(1);
});

// 启动监控
if (import.meta.url === `file://${process.argv[1]}`) {
  monitorDeployment().catch(console.error);
}
