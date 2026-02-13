import request from 'supertest';
import fs from 'fs';
import path from 'path';

let app;

describe('Upload endpoint', () => {
  beforeAll(async () => {
    const mod = await import('../server.js');
    app = mod.default || mod;
  });
  test('accepts image upload (guest)', async () => {
    const buffer = Buffer.from([0x89,0x50,0x4E,0x47]); // PNG header (partial)

    const res = await request(app)
      .post('/api/upload/image')
      .attach('image', buffer, 'test.png')
      .expect(200);

    expect(res.body).toHaveProperty('photoUrl');
    expect(res.body).toHaveProperty('filename');
    expect(res.body.mimetype).toMatch(/image\//);

    // cleanup uploaded file
    const uploadedPath = path.join(process.cwd(), 'backend', 'public', 'uploads', res.body.filename);
    if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
  });
});