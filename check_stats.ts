import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const models = ['user', 'platform', 'shiftLog', 'grievance', 'vulnerabilityFlag', 'anomalyFlag'] as const;
    
    console.log('--- Statistics ---');
    for (const model of models) {
        const count = await (prisma[model] as any).count();
        const dateRange = (model === 'platform') ? { min: null, max: null } : await (prisma[model] as any).aggregate({
            _min: { createdAt: true },
            _max: { createdAt: true }
        });
        
        console.log(`${model}: ${count} records, Range: ${JSON.stringify((dateRange as any)._min || dateRange)}`);
    }

    console.log('\n--- Shifts-per-week coverage (last 16 weeks) ---');
    const sixteenWeeksAgo = new Date();
    sixteenWeeksAgo.setDate(sixteenWeeksAgo.getDate() - 112);

    const shifts = await prisma.shiftLog.findMany({
        where: {
            createdAt: {
                gte: sixteenWeeksAgo
            }
        },
        select: {
            createdAt: true
        }
    });

    const weekCounts: { [key: string]: number } = {};
    const now = new Date();
    
    for (let i = 0; i < 16; i++) {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - (i * 7));
        // Simple week grouping
        const weekKey = startOfWeek.toISOString().split('T')[0];
        weekCounts[weekKey] = 0;
    }

    shifts.forEach(shift => {
        const date = new Date(shift.createdAt);
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        const weekIndex = Math.floor(diffDays / 7);
        if (weekIndex >= 0 && weekIndex < 16) {
             const keys = Object.keys(weekCounts).sort().reverse();
             weekCounts[keys[weekIndex]]++;
        }
    });

    Object.keys(weekCounts).sort().reverse().forEach(week => {
        console.log(`Week starting ${week}: ${weekCounts[week]} shifts`);
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
