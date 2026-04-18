import { Hono } from 'hono';
import {
  generateCertificate,
  previewCertificate,
  sampleCertificate,
  verifyCertificate,
} from './handlers';

const app = new Hono()
  .post('/generate', generateCertificate)
  .get('/preview', previewCertificate)
  .get('/sample', sampleCertificate)
  .get('/verify/:certificateId', verifyCertificate);

export default app;
