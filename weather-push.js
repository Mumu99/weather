/**
 * 每日天气推送脚本
 *
 * 流程：
 *   1. 调用和风天气 API 获取今日天气
 *   2. 通过微信测试号 API 获取 access_token
 *   3. 发送模板消息到微信
 *
 * 所需环境变量（在 GitHub Secrets 中设置）：
 *   WX_APPID       - 测试号 appID
 *   WX_SECRET       - 测试号 appsecret
 *   WX_TEMPLATE_ID  - 模板消息模板 ID
 *   WX_OPENID       - 接收者的 OpenID
 *   WEATHER_KEY     - 和风天气 API Key
 *   WEATHER_CITY    - 城市名称（如 深圳、北京）
 */

const https = require('https');
const zlib = require('zlib');

// ======================== 配置 ========================

const APPID = process.env.WX_APPID;
const SECRET = process.env.WX_SECRET;
const TEMPLATE_ID = process.env.WX_TEMPLATE_ID;
const OPENID = process.env.WX_OPENID;
const WEATHER_KEY = process.env.WEATHER_KEY;
const CITY = process.env.WEATHER_CITY || '深圳';

// ======================== HTTP 工具 ========================

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
    };
    https.get(options, (res) => {
      let chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const encoding = res.headers['content-encoding'];
        let data;
        if (encoding && encoding.includes('gzip')) {
          data = zlib.gunzipSync(buffer).toString();
        } else {
          data = buffer.toString();
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(body);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ======================== 获取天气 ========================

async function getWeather() {
  // 1. 获取城市 ID
  const geoUrl = `https://geoapi.qweather.com/v2/city/lookup?location=${encodeURIComponent(CITY)}&key=${WEATHER_KEY}`;
  const geoRes = await httpsGet(geoUrl);

  if (geoRes.code !== '200' || !geoRes.location || !geoRes.location.length) {
    throw new Error('获取城市信息失败: ' + JSON.stringify(geoRes));
  }

  const locationId = geoRes.location[0].id;

  // 2. 获取 3 天天气预报
  const weatherUrl = `https://devapi.qweather.com/v7/weather/3d?location=${locationId}&key=${WEATHER_KEY}`;
  const weatherRes = await httpsGet(weatherUrl);

  if (weatherRes.code !== '200' || !weatherRes.daily || !weatherRes.daily.length) {
    throw new Error('获取天气失败: ' + JSON.stringify(weatherRes));
  }

  const today = weatherRes.daily[0];

  // 3. 生成温馨提示
  const advice = getAdvice(today.textDay, Number(today.tempMax));

  console.log('🔄 天气原始数据:', JSON.stringify(today, null, 2));

  return {
    date: today.fxDate,
    weather: today.textDay,
    tempMin: today.tempMin,
    tempMax: today.tempMax,
    windDir: today.windDirDay || today.windDir,
    windScale: today.windScaleDay || today.windScale,
    humidity: today.humidity,
    advice,
  };
}

function getAdvice(weather, tempMax) {
  if (tempMax >= 35) return '高温预警，注意防暑降温 ☀️';
  if (weather.includes('雨') || weather.includes('雪')) return '出门记得带伞 🌂';
  if (tempMax <= 10) return '天气寒冷，注意保暖 🧣';
  if (weather.includes('雾') || weather.includes('霾')) return '空气质量不佳，建议戴口罩 😷';
  return '天气不错，适合出门走走 😊';
}

// ======================== 微信 API ========================

async function getAccessToken() {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${SECRET}`;
  const res = await httpsGet(url);

  if (!res.access_token) {
    throw new Error('获取 access_token 失败: ' + JSON.stringify(res));
  }

  return res.access_token;
}

async function sendTemplateMessage(token, weather) {
  const url = `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`;
  const body = {
    touser: OPENID,
    template_id: TEMPLATE_ID,
    url: 'https://github.com/mumu99/musicMumu',
    data: {
      date: { value: weather.date },
      city: { value: CITY },
      weather: { value: weather.weather },
      temp: { value: `${weather.tempMin}°C ~ ${weather.tempMax}°C` },
      wind: { value: `${weather.windDir} ${weather.windScale}级` },
      humidity: { value: `${weather.humidity}%` },
      advice: { value: weather.advice },
    },
  };

  const res = await httpsPost(url, body);

  if (res.errcode !== 0) {
    throw new Error('发送模板消息失败: ' + JSON.stringify(res));
  }

  console.log('✅ 推送成功！', res.msgid);
}

// ======================== 主流程 ========================

async function main() {
  console.log('🚀 开始执行每日天气推送...');
  console.log(`📍 城市: ${CITY}`);

  try {
    const weather = await getWeather();
    console.log('🌤  天气数据:', JSON.stringify(weather, null, 2));

    const token = await getAccessToken();
    console.log('🔑 获取 access_token 成功');

    await sendTemplateMessage(token, weather);
    console.log('🎉 推送完成！');
  } catch (err) {
    console.error('❌ 推送失败:', err.message);
    process.exit(1);
  }
}

main();
