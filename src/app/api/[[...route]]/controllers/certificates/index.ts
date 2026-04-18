import { Hono } from 'hono';
import { generateCertificate, previewCertificate, sampleCertificate } from './handlers';

const app = new Hono()
  .post('/generate', generateCertificate)
  .get('/preview', previewCertificate)
  .get('/sample', sampleCertificate);

export default app;
