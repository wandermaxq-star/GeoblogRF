// Тест API загрузки маркеров
import http from 'http';

const API_BASE = 'http://localhost:5000';

function makeRequest(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: path,
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data, error: e.message });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

async function testMarkersAPI() {
    console.log('🧪 Тестирование API загрузки маркеров...\n');

    try {
        console.log('📡 Запрос GET /markers...');
        const result = await makeRequest('/markers');

        console.log(`✅ Статус: ${result.status}`);

        if (Array.isArray(result.data)) {
            console.log(`📊 Получено маркеров: ${result.data.length}`);

            if (result.data.length > 0) {
                console.log('\n📍 Первые 3 маркера:');
                result.data.slice(0, 3).forEach((marker, i) => {
                    console.log(`\n${i + 1}. ${marker.title || 'Без названия'}`);
                    console.log(`   ID: ${marker.id}`);
                    console.log(`   Координаты: [${marker.latitude}, ${marker.longitude}]`);
                    console.log(`   Категория: ${marker.category || 'не указана'}`);
                    console.log(`   Адрес: ${marker.address || 'не указан'}`);
                });

                // Проверка маркеров по регионам
                const moscow = result.data.filter(m =>
                    m.address && (m.address.includes('Москв') || m.address.includes('Moscow'))
                );
                const vladimir = result.data.filter(m =>
                    m.address && (m.address.includes('Владимир') || m.address.includes('Vladimir'))
                );

                console.log(`\n🏙️ Статистика по регионам:`);
                console.log(`   Москва: ${moscow.length} маркеров`);
                console.log(`   Владимир: ${vladimir.length} маркеров`);

            } else {
                console.log('⚠️  База данных маркеров ПУСТАЯ!');
            }
        } else {
            console.log('❌ API вернул не массив:');
            console.log(JSON.stringify(result.data, null, 2));
        }

    } catch (error) {
        console.error('❌ Ошибка при тестировании API:');
        console.error(error.message);

        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Бэкенд не запущен или не отвечает на localhost:5000');
            console.log('   Запустите бэкенд: npm run start (в папке backend)');
        }
    }
}

testMarkersAPI();
