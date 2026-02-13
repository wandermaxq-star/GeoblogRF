import request from 'supertest';
import nock from 'nock';

let app;

describe('ORS proxy', () => {
  beforeAll(async () => {
    process.env.OPENROUTE_SERVICE_API_KEY = 'test-key';
    const mod = await import('../server.js');
    app = mod.default || mod;
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test('forwards coordinates to OpenRouteService and returns geojson', async () => {
    const profile = 'driving-car';
    const coordinates = [[37.6173, 55.7558], [37.6180, 55.7560]];

    const mockResponse = { type: 'FeatureCollection', features: [] };

    nock('https://api.openrouteservice.org')
      .post(`/v2/directions/${profile}/geojson`)
      .reply(200, mockResponse);

    const res = await request(app)
      .post(`/ors/v2/directions/${profile}/geojson`)
      .send({ coordinates })
      .set('Content-Type', 'application/json')
      .expect(200);

    expect(res.body).toEqual(mockResponse);
  });

  test('returns 400 when coordinates are invalid', async () => {
    const profile = 'driving-car';
    const res = await request(app)
      .post(`/ors/v2/directions/${profile}/geojson`)
      .send({ coordinates: [ [1,2] ] })
      .set('Content-Type', 'application/json')
      .expect(400);

    expect(res.body).toHaveProperty('error');
  });
});