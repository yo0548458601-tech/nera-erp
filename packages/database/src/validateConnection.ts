import 'dotenv/config';
import { prisma } from './client.js';

async function main() {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  console.info('Database connection is available.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
