import { db } from '../src/lib/db'

// Seed notifications for all users — simulates real system events
async function main() {
  const users = await db.user.findMany()
  const now = Date.now()

  const templates = [
    { title: 'Device Offline', message: 'Device LKD-0008 went offline in Surat', type: 'critical' },
    { title: 'Campaign Approved', message: 'Campaign "Spice Garden Lunch Promo" has been approved', type: 'success' },
    { title: 'Payment Received', message: 'Payment of ₹23,500 received from FreshMart FMCG', type: 'success' },
    { title: 'Campaign Ending Soon', message: 'Campaign "Skyline Monsoon Offer" ends in 2 days', type: 'warning' },
    { title: 'SIM Data Warning', message: 'SIM for device LKD-0004 has used 82% of monthly data', type: 'warning' },
    { title: 'Service Ticket Assigned', message: 'Ticket TKT-0003 has been assigned to you', type: 'info' },
    { title: 'Payout Processed', message: 'Payout of ₹1,240 for August has been processed', type: 'success' },
    { title: 'High Temperature Alert', message: 'Device LKD-0001 temperature reached 52°C', type: 'warning' },
    { title: 'Campaign Rejected', message: 'Campaign "Ratnakar Festive Gold" requires media approval first', type: 'critical' },
    { title: 'New Device Registered', message: 'Device LKD-0010 registered in Pune', type: 'info' },
  ]

  for (const user of users) {
    // Give each user 5-8 notifications
    const count = 5 + Math.floor(Math.random() * 4)
    for (let i = 0; i < count; i++) {
      const t = templates[i % templates.length]
      await db.notification.create({
        data: {
          userId: user.id,
          title: t.title,
          message: t.message,
          type: t.type,
          read: i > 3, // first 4 unread, rest read
          createdAt: new Date(now - i * 3600000 * (1 + Math.random() * 5)),
        },
      })
    }
  }
  console.log(`Seeded notifications for ${users.length} users`)
}

main().catch(console.error).finally(() => db.$disconnect())
