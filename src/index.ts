import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import ManagerRouter from './modules/managers/managers.routes';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_, res) => res.send('OK'));
app.use('/api/v1/managers', ManagerRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      details: `The route ${req.method} ${req.path} does not exist.`,
    },
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
