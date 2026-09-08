import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth'

const db = new PrismaClient()

async function seed() {
  console.log('🌱 Seeding database...')

  const adminPass = await hashPassword('admin123')
  const mgrPass = await hashPassword('manager123')
  const engPass = await hashPassword('engineer123')

  const admin = await db.user.create({
    data: { engineerCode: 'ADM001', name: 'System Admin', password: adminPass, role: 'ADMIN', phone: '9876543210', status: 'ACTIVE' },
  })
  console.log('  Created admin:', admin.engineerCode)

  const mgr1 = await db.user.create({
    data: { engineerCode: 'MGR001', name: 'Rajesh Kumar', password: mgrPass, role: 'MANAGER', phone: '9876543211', status: 'ACTIVE' },
  })
  const mgr2 = await db.user.create({
    data: { engineerCode: 'MGR002', name: 'Priya Sharma', password: mgrPass, role: 'MANAGER', phone: '9876543212', status: 'ACTIVE' },
  })
  console.log('  Created managers:', mgr1.engineerCode, mgr2.engineerCode)

  const engineersData = [
    { code: 'FE1001', name: 'Arun Mehta', mgrId: mgr1.id },
    { code: 'FE1002', name: 'Suresh Patel', mgrId: mgr1.id },
    { code: 'FE1003', name: 'Vikram Singh', mgrId: mgr1.id },
    { code: 'FE1004', name: 'Deepak Joshi', mgrId: mgr1.id },
    { code: 'FE1005', name: 'Karan Malhotra', mgrId: mgr1.id },
    { code: 'FE1006', name: 'Ravi Verma', mgrId: mgr2.id },
    { code: 'FE1007', name: 'Amit Sharma', mgrId: mgr2.id },
    { code: 'FE1008', name: 'Nikhil Gupta', mgrId: mgr2.id },
  ]
  const engineers = []
  for (const e of engineersData) {
    const eng = await db.user.create({
      data: { engineerCode: e.code, name: e.name, password: engPass, role: 'ENGINEER', status: 'ACTIVE', managerId: e.mgrId, phone: `987650${1000 + engineers.length}` },
    })
    engineers.push(eng)
  }
  console.log('  Created engineers:', engineers.length)

  const sitesData = [
    { code: 'SITE001', name: 'Central Mall Installation', district: 'Mumbai', region: 'West', vendor: 'TechCorp', lat: 19.076, lng: 72.8777 },
    { code: 'SITE002', name: 'Phoenix Mall Upgrade', district: 'Pune', region: 'West', vendor: 'InfraTech', lat: 18.5204, lng: 73.8567 },
    { code: 'SITE003', name: 'Hub Mall Setup', district: 'Mumbai', region: 'West', vendor: 'TechCorp', lat: 19.1197, lng: 72.8464 },
    { code: 'SITE004', name: 'Lulu Mall Install', district: 'Kochi', region: 'South', vendor: 'BuildMax', lat: 9.9312, lng: 76.2673 },
    { code: 'SITE005', name: 'Express Avenue Setup', district: 'Chennai', region: 'South', vendor: 'InfraTech', lat: 13.0067, lng: 80.2206 },
    { code: 'SITE006', name: 'Select Citywalk Install', district: 'Delhi', region: 'North', vendor: 'TechCorp', lat: 28.5494, lng: 77.2167 },
    { code: 'SITE007', name: 'DLF Mall Upgrade', district: 'Gurgaon', region: 'North', vendor: 'BuildMax', lat: 28.4595, lng: 77.0266 },
    { code: 'SITE008', name: 'Inorbit Mall Setup', district: 'Hyderabad', region: 'South', vendor: 'TechCorp', lat: 17.4326, lng: 78.4071 },
    { code: 'SITE009', name: 'Mantri Square Install', district: 'Bangalore', region: 'South', vendor: 'InfraTech', lat: 12.9819, lng: 77.5594 },
    { code: 'SITE010', name: 'Phoenix Marketcity', district: 'Bangalore', region: 'South', vendor: 'BuildMax', lat: 12.9698, lng: 77.7500 },
    { code: 'SITE011', name: 'Elante Mall Install', district: 'Chandigarh', region: 'North', vendor: 'TechCorp', lat: 30.7046, lng: 76.7179 },
    { code: 'SITE012', name: 'Phoenix Mall Chennai', district: 'Chennai', region: 'South', vendor: 'InfraTech', lat: 13.0072, lng: 80.2581 },
    { code: 'SITE013', name: 'Pacific Mall Setup', district: 'Delhi', region: 'North', vendor: 'BuildMax', lat: 28.6952, lng: 77.1425 },
    { code: 'SITE014', name: 'VR Mall Install', district: 'Kochi', region: 'South', vendor: 'TechCorp', lat: 9.9681, lng: 76.2999 },
    { code: 'SITE015', name: 'Palladium Mall Upgrade', district: 'Mumbai', region: 'West', vendor: 'InfraTech', lat: 19.0176, lng: 72.8514 },
  ]
  const sites = []
  for (const s of sitesData) {
    const site = await db.site.create({
      data: { siteCode: s.code, siteName: s.name, district: s.district, region: s.region, vendor: s.vendor, latitude: s.lat, longitude: s.lng, googleLink: `https://maps.google.com/?q=${s.lat},${s.lng}` },
    })
    sites.push(site)
  }
  console.log('  Created sites:', sites.length)

  const storesData = [
    { code: 'STR001', name: 'Reliance Digital Central', district: 'Mumbai', region: 'West', lat: 19.076, lng: 72.878, phone: '022-23456789' },
    { code: 'STR002', name: 'Croma Phoenix', district: 'Pune', region: 'West', lat: 18.5204, lng: 73.857, phone: '020-25678901' },
    { code: 'STR003', name: 'Vijay Sales Hub', district: 'Mumbai', region: 'West', lat: 19.1197, lng: 72.847, phone: '022-26789012' },
    { code: 'STR004', name: 'Reliance Digital Lulu', district: 'Kochi', region: 'South', lat: 9.9312, lng: 76.268, phone: '0484-3456789' },
    { code: 'STR005', name: 'Croma Express Avenue', district: 'Chennai', region: 'South', lat: 13.0067, lng: 80.221, phone: '044-45678901' },
    { code: 'STR006', name: 'Vijay Sales Select', district: 'Delhi', region: 'North', lat: 28.5494, lng: 77.217, phone: '011-56789012' },
    { code: 'STR007', name: 'Reliance Digital DLF', district: 'Gurgaon', region: 'North', lat: 28.4595, lng: 77.027, phone: '0124-67890123' },
    { code: 'STR008', name: 'Croma Inorbit', district: 'Hyderabad', region: 'South', lat: 17.4326, lng: 78.408, phone: '040-78901234' },
    { code: 'STR009', name: 'Vijay Sales Mantri', district: 'Bangalore', region: 'South', lat: 12.9819, lng: 77.560, phone: '080-89012345' },
    { code: 'STR010', name: 'Reliance Digital Phoenix', district: 'Bangalore', region: 'South', lat: 12.9698, lng: 77.751, phone: '080-90123456' },
  ]
  const stores = []
  for (const s of storesData) {
    const store = await db.store.create({
      data: { storeCode: s.code, storeName: s.name, district: s.district, region: s.region, latitude: s.lat, longitude: s.lng, googleLink: `https://maps.google.com/?q=${s.lat},${s.lng}`, contactNumber: s.phone },
    })
    stores.push(store)
  }
  console.log('  Created stores:', stores.length)

  const today = new Date()
  const formatDate = (d: Date) => d.toISOString().split('T')[0]
  const statuses = ['ASSIGNED', 'PENDING', 'COMPLETED', 'HOLD', 'CANCELLED', 'RESCHEDULED'] as const
  const activities = ['Installation', 'Maintenance', 'Inspection', 'Upgrade', 'Repair', 'Survey']

  let scheduleCount = 0
  for (let dayOffset = -3; dayOffset <= 3; dayOffset++) {
    const date = new Date(today)
    date.setDate(date.getDate() + dayOffset)
    const dateStr = formatDate(date)

    for (let i = 0; i < engineers.length; i++) {
      const eng = engineers[i]
      const numSites = 2 + (i % 3) // 2-4 sites per day
      for (let j = 0; j < numSites; j++) {
        const siteIdx = (i * 3 + j + dayOffset * 2 + sites.length) % sites.length
        const storeIdx = (i + j) % stores.length
        let status: string
        if (dayOffset < 0) status = 'COMPLETED'
        else if (dayOffset === 0) status = j < 1 ? 'COMPLETED' : j < 2 ? 'PENDING' : 'ASSIGNED'
        else status = 'ASSIGNED'

        await db.schedule.create({
          data: {
            date: dateStr, engineerId: eng.id, siteId: sites[siteIdx].id, storeId: stores[storeIdx].id,
            vendor: sites[siteIdx].vendor!, activity: activities[j % activities.length], status,
            remarks: status === 'COMPLETED' ? 'Work completed successfully' : status === 'HOLD' ? 'Waiting for parts' : null,
          },
        })
        scheduleCount++
      }
    }
  }
  console.log('  Created schedules:', scheduleCount)

  // Create visits for completed schedules
  const completedSchedules = await db.schedule.findMany({ where: { status: 'COMPLETED' }, take: 15, include: { engineer: true } })
  for (const sch of completedSchedules) {
    await db.visit.create({
      data: {
        scheduleId: sch.id, engineerId: sch.engineerId, visitNumber: 1,
        checkInTime: new Date(`${sch.date}T09:00:00`), checkOutTime: new Date(`${sch.date}T10:30:00`),
        status: 'COMPLETED', remarks: 'Visited and completed the task', gps: `${19.076 + Math.random() * 0.1},${72.877 + Math.random() * 0.1}`,
      },
    })
  }
  console.log('  Created visits:', completedSchedules.length)

  // Notifications
  await db.notification.createMany({
    data: [
      { userId: admin.id, title: 'Schedule Imported', message: 'New schedule batch imported with 45 records', type: 'SUCCESS' },
      { userId: mgr1.id, title: 'Team Update', message: '5 engineers have completed their morning schedules', type: 'INFO' },
      { userId: engineers[0].id, title: 'New Assignment', message: 'You have been assigned 3 new sites for today', type: 'INFO' },
      { userId: engineers[1].id, title: 'Site Completed', message: 'SITE001 has been marked as completed', type: 'SUCCESS' },
    ],
  })
  console.log('  Created notifications: 4')

  console.log('✅ Seeding complete!')
}

seed().catch(console.error).finally(() => db.$disconnect())
