#!/usr/bin/env node

/**
 * 快速诊断脚本 - 检查配置是否正确
 * 
 * 使用方法：
 *   node diagnose.js
 */

const https = require('https');

// 从环境变量或命令行参数读取配置
const APPID = process.env.WX_APPID || process.argv[2];
const SECRET = process.env.WX_SECRET || process.argv[3];
const TEMPLATE_ID = process.env.WX_TEMPLATE_ID || process.argv[4];
const OPENID = process.env.WX_OPENID || process.argv[5];
const WEATHER_KEY = process.env.WEATHER_KEY || process.argv[6];
const CITY = process.env.WEATHER_CITY || process.argv[7] || '深圳';

console.log('🔍 开始诊断...\n');

// 检查环境变量
console.log('📝 检查配置：');
console.log(`  WX_APPID: ${APPID ? '✅' : '❌'}`);
console.log(`  WX_SECRET: ${SECRET ? '✅' : '❌'}`);
console.log(`  WX_TEMPLATE_ID: ${TEMPLATE_ID ? '✅' : '❌'}`);
console.log(`  WX_OPENID: ${OPENID ? '✅' : '❌'}`);
console.log(`  WEATHER_KEY: ${WEATHER_KEY ? '✅' : '❌'}`);
console.log(`  WEATHER_CITY: ${CITY}\n`);

if (!APPID || !SECRET || !TEMPLATE_ID || !OPENID || !WEATHER_KEY) {
  console.error('❌ 错误：缺少必要的配置！\n');
  console.log('使用方法：');
  console.log('  方式1：设置环境变量后运行');
  console.log('    export WX_APPID="xxx"');
  console.log('    node diagnose.js');
  console.log('  方式2：直接传参');
  console.log('    node diagnose.js <APPID> <SECRET> <TEMPLATE_ID> <OPENID> <WEATHER_KEY> [CITY]\n');
  process.exit(1);
}

// 测试微信 API
async function testWechatAPI() {
  console.log('🧪 测试 1：获取微信 access_token...');
  
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${SECRET}`;
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.access_token) {
            console.log('  ✅ 获取成功');
            resolve(json.access_token);
          } else {
            console.error('  ❌ 失败:', json.errmsg);
            reject(new Error(json.errmsg));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// 测试天气 API
async function testWeatherAPI() {
  console.log('\n🧪 测试 2：获取天气数据...');
  
  const url = `https://geoapi.qweather.com/v2/city/lookup?location=${encodeURIComponent(CITY)}&key=${WEATHER_KEY}`;
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.code === '200' && json.location && json.location.length > 0) {
            console.log(`  ✅ 找到城市: ${json.location[0].name}`);
            resolve(json.location[0].id);
          } else {
            console.error('  ❌ 失败:', json.message || '未知错误');
            reject(new Error('获取城市失败'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// 主流程
async function main() {
  try {
    const token = await testWechatAPI();
    const cityId = await testWeatherAPI();
    
    console.log('\n✅ 诊断完成！配置看起来正常。');
    console.log('\n📋 建议下一步：');
    console.log('  1. 检查 GitHub Actions 执行历史');
    console.log('  2. 确认 GitHub Secrets 已正确配置');
    console.log('  3. 手动触发一次工作流测试');
    
  } catch (err) {
    console.error('\n❌ 诊断失败:', err.message);
    console.log('\n💡 可能的原因：');
    console.log('  1. APPID 或 SECRET 错误');
    console.log('  2. 和风天气 API Key 无效或次数用尽');
    console.log('  3. 网络连接问题');
    process.exit(1);
  }
}

main();
