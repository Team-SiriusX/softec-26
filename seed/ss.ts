import 'dotenv/config';
import db from '@/lib/db';

async function main() {
  const newUrl = 'https://umvryazi6u.ufs.sh/f/prneloVimAMOIiCXmyQnU1CEktAIWl54iKz3Qsb0YwcjpDPX';
  
  console.log('Updating all screenshot URLs to:', newUrl);

  try {
    const result = await db.screenshot.updateMany({
      data: {
        fileUrl: newUrl,
      },
    });

    console.log(`Successfully updated ${result.count} screenshots.`);
  } catch (error) {
    console.error('Error updating screenshots:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
