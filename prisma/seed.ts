import { db } from '../src/lib/db'
import { hashPassword } from '../src/lib/auth'
import { seedRoles } from '../src/lib/rbac'
import { randomBytes } from 'crypto'

// LakhirAd CMS seed — realistic Indian DOOH demo data
// Run: bun run db:seed

const CITIES = [
  { name: 'Vadodara', state: 'Gujarat', lat: 22.3072, lng: 73.1812 },
  { name: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714 },
  { name: 'Surat', state: 'Gujarat', lat: 21.1702, lng: 72.8311 },
  { name: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567 },
  { name: 'Indore', state: 'Madhya Pradesh', lat: 22.7196, lng: 75.8577 },
]

const ZONES = [
  'Alkapuri', 'Sayajigunj', 'Fateganj', 'Akota', 'Manjalpur',
  'Navrangpura', 'Satellite', 'Bodakdev', 'CG Road', 'SG Highway',
]

const ADVERTISER_CATEGORIES = ['Restaurant', 'Jewellery', 'Education', 'Real Estate', 'FMCG', 'Healthcare', 'Automotive', 'Fashion']
const FIRST_NAMES = ['Rajesh', 'Amit', 'Suresh', 'Mahesh', 'Deepak', 'Vijay', 'Ramesh', 'Anil', 'Sanjay', 'Prakash', 'Kiran', 'Nilesh', 'Hardik', 'Jignesh', 'Bhavesh']
const LAST_NAMES = ['Patel', 'Shah', 'Desai', 'Mehta', 'Joshi', 'Gupta', 'Sharma', 'Verma', 'Singh', 'Reddy', 'Nair', 'Iyer', 'Pillai', 'Rao', 'Das']

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick(n: number) { return Math.random() < n }
function genPhone() { return `+91${randInt(70, 99)}${randInt(100, 999)}${randInt(10000, 99999)}` }
function genRegNo(city: string) {
  const code = city === 'Vadodara' ? 'GJ06' : city === 'Ahmedabad' ? 'GJ01' : city === 'Surat' ? 'GJ05' : city === 'Pune' ? 'MH12' : 'MP07'
  return `${code} ${String.fromCharCode(65 + randInt(0, 25))}${String.fromCharCode(65 + randInt(0, 25))} ${randInt(1000, 9999)}`
}

async function main() {
  console.log('Seeding LakhirAd CMS...')

  // 1. Roles
  await seedRoles()

  // 2. Settings
  const settings = [
    { key: 'brand_name', value: 'LakhirAd', category: 'general' },
    { key: 'tagline', value: 'Smart Digital Advertising Network', category: 'general' },
    { key: 'timezone', value: 'Asia/Kolkata', category: 'general' },
    { key: 'currency', value: 'INR', category: 'general' },
    { key: 'language', value: 'en', category: 'general' },
    { key: 'heartbeat_interval_sec', value: '60', category: 'device' },
    { key: 'offline_threshold_min', value: '5', category: 'device' },
    { key: 'critical_offline_threshold_min', value: '15', category: 'device' },
    { key: 'storage_threshold_pct', value: '85', category: 'device' },
    { key: 'temperature_threshold_c', value: '55', category: 'device' },
    { key: 'default_ad_duration_sec', value: '15', category: 'campaign' },
    { key: 'default_platform_share', value: '60', category: 'revenue' },
    { key: 'default_owner_share', value: '15', category: 'revenue' },
    { key: 'default_driver_share', value: '25', category: 'revenue' },
    { key: 'base_participation_inr', value: '500', category: 'revenue' },
    { key: 'uptime_bonus_inr', value: '200', category: 'revenue' },
    { key: 'campaign_bonus_inr', value: '100', category: 'revenue' },
    { key: 'password_min_length', value: '8', category: 'security' },
    { key: 'session_duration_hours', value: '168', category: 'security' },
  ]
  for (const s of settings) {
    await db.setting.upsert({ where: { key: s.key }, update: { value: s.value }, create: s })
  }

  // 3. Earning rule
  await db.earningRule.upsert({
    where: { id: 'default-rule' },
    update: {},
    create: {
      id: 'default-rule',
      name: 'Default Earning Rule',
      platformShare: 60,
      ownerShare: 15,
      driverShare: 25,
      baseParticipation: 500,
      uptimeBonus: 200,
      campaignBonus: 100,
      complianceBonus: 100,
      servicePenalty: 50,
      isActive: true,
    },
  })

  // 4. Cities + Zones
  const cityRecords = []
  for (const c of CITIES) {
    const city = await db.city.create({ data: { name: c.name, state: c.state, latitude: c.lat, longitude: c.lng } })
    cityRecords.push(city)
    for (let i = 0; i < 3; i++) {
      const zname = rand(ZONES)
      await db.zone.create({ data: { cityId: city.id, name: zname, latitude: c.lat + (Math.random() - 0.5) * 0.1, longitude: c.lng + (Math.random() - 0.5) * 0.1, radiusKm: randInt(2, 6) } })
    }
  }

  // 5. Organizations + Advertisers (5)
  const advertisers = []
  const advData = [
    { name: 'Spice Garden Restaurants', cat: 'Restaurant' },
    { name: 'Ratnakar Jewellers', cat: 'Jewellery' },
    { name: 'Brilliant Academy', cat: 'Education' },
    { name: 'Skyline Properties', cat: 'Real Estate' },
    { name: 'FreshMart FMCG', cat: 'FMCG' },
  ]
  for (const a of advData) {
    const org = await db.organization.create({
      data: {
        name: a.name, type: 'advertiser', gstin: `24${randInt(1000000, 9999999)}Z${randInt(100, 999)}A1`,
        pan: `A${randInt(10000, 99999)}P${randInt(1000, 9999)}C`, address: `${randInt(1, 200)}, ${rand(ZONES)}`, city: 'Vadodara', state: 'Gujarat', phone: genPhone(), email: `info@${a.name.toLowerCase().replace(/\s+/g, '')}.com`,
      },
    })
    const adv = await db.advertiser.create({
      data: {
        organizationId: org.id, contactName: `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`, contactPhone: genPhone(), contactEmail: `contact@${a.name.toLowerCase().replace(/\s+/g, '')}.com`,
        category: a.cat, billingAddress: `${randInt(1, 200)}, ${rand(ZONES)}, Vadodara`, creditLimit: randInt(50000, 500000), status: 'active',
      },
    })
    advertisers.push(adv)
  }

  // 6. Vehicle owners (5)
  const owners = []
  for (let i = 0; i < 5; i++) {
    const owner = await db.vehicleOwner.create({
      data: {
        name: `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`, mobile: genPhone(), email: `owner${i + 1}@gmail.com`, address: `${randInt(1, 200)}, ${rand(ZONES)}, Vadodara`, city: 'Vadodara',
        bankAccount: `${randInt(10000000000, 99999999999)}`, bankIfsc: `BARB0VADODA`, upiId: `owner${i + 1}@okhdfcbank`, revenueShare: randInt(30, 50), status: 'active',
      },
    })
    owners.push(owner)
  }

  // 7. Drivers (8)
  const drivers = []
  for (let i = 0; i < 8; i++) {
    const d = await db.driver.create({
      data: {
        name: `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`, mobile: genPhone(), email: `driver${i + 1}@gmail.com`, city: rand(CITIES).name,
        kycStatus: pick(0.8) ? 'verified' : 'pending', agreementStatus: pick(0.85) ? 'signed' : 'pending',
        bankAccount: `${randInt(10000000000, 99999999999)}`, bankIfsc: `BARB0VADODA`, upiId: `driver${i + 1}@okhdfcbank`,
        driverScore: randInt(60, 95), status: 'active', joiningDate: new Date(Date.now() - randInt(30, 365) * 86400000),
      },
    })
    drivers.push(d)
  }

  // 8. Screens (10) + Devices (10) + SIMs (10) + Vehicles (10)
  const devices = []
  const vehicles = []
  const manufacturers = ['Samsung', 'LG', 'Dell', 'AOC']
  const screenModels = ['DM15.6', 'PM21.5', 'XL18.5', 'BE15.6']
  const deviceModels = ['LakhirAd Player Pro', 'LakhirAd Player Lite', 'LakhirAd Player X1']
  const operators = ['Jio', 'Airtel', 'Vi', 'BSNL']

  for (let i = 0; i < 10; i++) {
    const city = rand(cityRecords)
    const owner = rand(owners)
    const driver = rand(drivers)
    const regNo = genRegNo(city.name)

    // Screen
    const screen = await db.screen.create({
      data: {
        screenId: `SCR-${String(i + 1).padStart(4, '0')}`, model: rand(screenModels), size: pick(0.5) ? '15.6"' : '18.5"', resolution: '1920x1080',
        orientation: pick(0.7) ? 'landscape' : 'portrait', brightness: randInt(60, 100), manufacturer: rand(manufacturers),
        serialNumber: `SN${randInt(100000, 999999)}`, warranty: '24 months', status: 'active',
      },
    })

    // SIM
    const sim = await db.simCard.create({
      data: {
        iccid: `8991${randInt(100000000000000, 999999999999999)}`, imei: `${randInt(100000000000000, 999999999999999)}`,
        operator: rand(operators), network: '4G', dataPlan: '1.5GB/day', monthlyAllowanceMb: 45000, currentUsageMb: randInt(5000, 40000),
        activationDate: new Date(Date.now() - randInt(30, 300) * 86400000), renewalDate: new Date(Date.now() + randInt(1, 25) * 86400000), status: 'active',
      },
    })

    // Device
    const status = pick(0.85) ? 'online' : pick(0.5) ? 'offline' : 'warning'
    const lat = (city.latitude || 22.3) + (Math.random() - 0.5) * 0.15
    const lng = (city.longitude || 73.18) + (Math.random() - 0.5) * 0.15
    const device = await db.device.create({
      data: {
        deviceId: `LKD-${String(i + 1).padStart(4, '0')}`, serialNumber: `LKD-SN-${randInt(100000, 999999)}`, imei: `${randInt(100000000000000, 999999999999999)}`,
        model: rand(deviceModels), playerVersion: '2.4.1', androidVersion: '11', cityId: city.id, zone: rand(ZONES),
        latitude: lat, longitude: lng, status, networkType: '4G', signalStrength: randInt(20, 95),
        ipAddress: `10.0.${randInt(1, 255)}.${randInt(1, 255)}`, temperature: randInt(35, 52),
        storageUsage: randInt(40, 85), ramUsage: randInt(45, 80), uptimeSeconds: randInt(3600, 2500000),
        lastHeartbeat: new Date(Date.now() - randInt(10, 600) * 1000), simId: sim.id,
        installationDate: new Date(Date.now() - randInt(30, 400) * 86400000), warranty: '12 months',
        lastServiceDate: new Date(Date.now() - randInt(5, 60) * 86400000),
      },
    })
    devices.push(device)

    // Vehicle
    const vehicle = await db.vehicle.create({
      data: {
        registrationNo: regNo, vehicleType: 'auto_rickshaw', manufacturer: pick(0.6) ? 'Bajaj' : 'Piaggio', model: pick(0.6) ? 'RE' : 'Ape',
        cityId: city.id, zone: rand(ZONES), ownerId: owner.id, driverId: driver.id,
        agreementStatus: 'signed', status: 'active', installationDate: new Date(Date.now() - randInt(30, 300) * 86400000),
      },
    })
    vehicles.push(vehicle)

    // Link screen+device to vehicle
    await db.screen.update({ where: { id: screen.id }, data: { vehicleId: vehicle.id } })
    await db.device.update({ where: { id: device.id }, data: { vehicleId: vehicle.id, driverId: driver.id, ownerId: owner.id } })

    // Heartbeats (last 10 per device)
    for (let h = 0; h < 10; h++) {
      await db.deviceHeartbeat.create({
        data: {
          deviceId: device.id, timestamp: new Date(Date.now() - h * 60000), latitude: lat, longitude: lng,
          signalStrength: randInt(20, 95), networkType: '4G', temperature: randInt(35, 52),
          storageUsage: randInt(40, 85), ramUsage: randInt(45, 80), uptimeSeconds: randInt(3600, 2500000),
          screenStatus: 'on', appStatus: 'running',
        },
      })
    }

    // Health
    await db.deviceHealth.create({
      data: {
        deviceId: device.id, timestamp: new Date(), online: status === 'online', signalStrength: randInt(20, 95),
        gpsFix: pick(0.9), temperature: randInt(35, 52), storageUsage: randInt(40, 85), ramUsage: randInt(45, 80),
        uptimeSeconds: randInt(3600, 2500000), networkType: '4G',
      },
    })

    // Alerts for offline/warning devices
    if (status === 'offline') {
      await db.alert.create({ data: { deviceId: device.id, type: 'device_offline', severity: 'critical', message: `Device ${device.deviceId} is offline (no heartbeat)` } })
    } else if (status === 'warning') {
      await db.alert.create({ data: { deviceId: device.id, type: 'high_temperature', severity: 'warning', message: `Device ${device.deviceId} temperature elevated` } })
    }
  }

  // 9. Media files (20)
  const mediaNames = [
    'Spice Garden Lunch Combo', 'Ratnakar Gold Necklace', 'Brilliant NEET Coaching', 'Skyline 3BHK Apartments',
    'FreshMart Diwali Sale', 'Spice Garden Dinner Special', 'Ratnakar Diamond Ring', 'Brilliant JEE Course',
    'Skyline Villa Project', 'FreshMart Organic Range', 'LakhirAd House Ad', 'Spice Garden Catering',
    'Ratnakar Bridal Collection', 'Brilliant Online Classes', 'Skyline Commercial Space', 'FreshMart Home Delivery',
    'Spice Garden Festival Menu', 'Ratnakar Akshaya Tritiya', 'Brilliant Scholarship Test', 'Skyline Plot Scheme',
  ]
  const mediaList = []
  for (let i = 0; i < 20; i++) {
    const isVideo = pick(0.6)
    const adv = advertisers[i % advertisers.length]
    const m = await db.media.create({
      data: {
        name: mediaNames[i], fileName: `media_${i + 1}.${isVideo ? 'mp4' : 'jpg'}`, fileUrl: `/uploads/media_${i + 1}.${isVideo ? 'mp4' : 'jpg'}`,
        thumbnailUrl: `/uploads/thumb_${i + 1}.jpg`, type: isVideo ? 'video' : 'image', format: isVideo ? 'mp4' : 'jpg',
        sizeBytes: randInt(500000, 20000000), resolution: '1920x1080', durationSec: isVideo ? randInt(10, 30) : 0,
        advertiserId: adv.id, organizationId: adv.organizationId, approvalStatus: pick(0.7) ? 'approved' : pick(0.5) ? 'pending_approval' : 'draft',
        usageCount: randInt(0, 50), qrUrl: pick(0.3) ? 'https://lakhirad.com/offer' : null,
      },
    })
    mediaList.push(m)
  }

  // 10. Playlists (5)
  const playlistNames = ['LakhirAd Vadodara Morning', 'Lakhirad Ahmedabad Evening', 'LakhirAd Surat Prime', 'LakhirAd Pune Daytime', 'LakhirAd House Rotation']
  const playlists = []
  for (let i = 0; i < 5; i++) {
    const pl = await db.playlist.create({
      data: {
        name: playlistNames[i], description: `Standard rotation playlist for ${playlistNames[i]}`,
        city: rand(CITIES).name, zone: rand(ZONES), priority: randInt(3, 5), status: 'active',
      },
    })
    // Add 5 items
    for (let j = 0; j < 5; j++) {
      const media = rand(mediaList)
      await db.playlistItem.create({ data: { playlistId: pl.id, mediaId: media.id, order: j, durationSec: randInt(10, 20), frequency: 1 } })
    }
    playlists.push(pl)
  }

  // 11. Campaigns (10)
  const campaignNames = [
    'Spice Garden Lunch Promo', 'Ratnakar Festive Gold', 'Brilliant NEET Batch 2026', 'Skyline Monsoon Offer',
    'FreshMart Diwali Dhamaka', 'Spice Garden Weekend Special', 'Ratnakar Wedding Season', 'Brilliant Crash Course',
    'Skyline Investment Plan', 'FreshMart Daily Essentials',
  ]
  const campaignStatuses = ['live', 'live', 'scheduled', 'live', 'completed', 'payment_pending', 'approved', 'under_review', 'draft', 'live']
  for (let i = 0; i < 10; i++) {
    const adv = advertisers[i % advertisers.length]
    const pl = rand(playlists)
    const startOffset = randInt(-30, 30)
    const startDate = new Date(Date.now() + startOffset * 86400000)
    const endDate = new Date(startDate.getTime() + randInt(7, 60) * 86400000)
    const targetDeviceCount = randInt(20, 500)
    const budget = targetDeviceCount * randInt(20, 50)
    const campaign = await db.campaign.create({
      data: {
        name: campaignNames[i], advertiserId: adv.id, organizationId: adv.organizationId, playlistId: pl.id,
        status: campaignStatuses[i], priority: randInt(3, 5),
        startDate, endDate, startTime: '09:00', endTime: '21:00', daysOfWeek: '1,2,3,4,5,6',
        frequencyPerHour: randInt(2, 8), budget, priceQuoted: budget, amountPaid: campaignStatuses[i] === 'live' || campaignStatuses[i] === 'completed' ? budget : 0,
        targetCities: rand(CITIES).name, targetZones: rand(ZONES), targetDeviceCount,
      },
    })
    // Assign devices
    const assignedDevices = devices.slice(0, randInt(3, 8))
    for (const d of assignedDevices) {
      await db.campaignDevice.create({ data: { campaignId: campaign.id, deviceId: d.id, status: campaignStatuses[i] === 'live' ? 'active' : 'selected' } })
    }
    // Approval history
    await db.campaignApprovalHistory.create({ data: { campaignId: campaign.id, action: 'submitted', note: 'Campaign submitted by advertiser' } })
    if (['live', 'scheduled', 'completed'].includes(campaignStatuses[i])) {
      await db.campaignApprovalHistory.create({ data: { campaignId: campaign.id, action: 'approved', note: 'Approved by Ops Admin' } })
    }
    if (campaignStatuses[i] === 'live') {
      await db.campaignApprovalHistory.create({ data: { campaignId: campaign.id, action: 'published' } })
    }

    // Playback events (for live/completed campaigns)
    if (['live', 'completed'].includes(campaignStatuses[i])) {
      for (let p = 0; p < 50; p++) {
        const dev = rand(assignedDevices)
        const veh = vehicles.find((v) => v.deviceId === dev.id)
        await db.playbackEvent.create({
          data: {
            campaignId: campaign.id, creativeId: rand(mediaList).id, deviceId: dev.id, vehicleId: veh?.id,
            timestamp: new Date(Date.now() - randInt(1, 1440) * 60000), scheduledPlay: true, actualPlay: true,
            durationSec: randInt(10, 20), completionPct: pick(0.9) ? 100 : randInt(50, 90),
            status: pick(0.85) ? 'completed' : pick(0.6) ? 'partial' : 'failed',
          },
        })
      }
    }

    // Invoice for paid campaigns
    if (campaignStatuses[i] === 'live' || campaignStatuses[i] === 'completed') {
      const gst = budget * 0.18
      const inv = await db.invoice.create({
        data: {
          invoiceNumber: `INV-2026-${String(i + 1).padStart(4, '0')}`, campaignId: campaign.id, advertiserId: adv.id, organizationId: adv.organizationId,
          amount: budget, gst, totalAmount: budget + gst, status: 'paid', dueDate: new Date(Date.now() + 7 * 86400000), paidAt: new Date(),
        },
      })
      await db.payment.create({ data: { invoiceId: inv.id, amount: budget + gst, method: 'upi', provider: 'manual', status: 'success' } })

      // Revenue transaction
      await db.revenueTransaction.create({
        data: {
          campaignId: campaign.id, grossRevenue: budget, platformShare: budget * 0.6, ownerShare: budget * 0.15,
          driverShare: budget * 0.25, iotCost: budget * 0.05, cloudCost: budget * 0.03, paymentFee: budget * 0.02,
          netRevenue: budget * 0.6 - budget * 0.05 - budget * 0.03 - budget * 0.02, city: rand(CITIES).name,
        },
      })
    }
  }

  // 12. Driver earnings (current month)
  const currentMonth = new Date().toISOString().slice(0, 7)
  for (const d of drivers) {
    const base = 500
    const revShare = randInt(300, 800)
    const uptime = randInt(100, 300)
    const camp = randInt(50, 200)
    const compliance = randInt(50, 150)
    const penalty = pick(0.2) ? 50 : 0
    await db.driverEarning.create({
      data: {
        driverId: d.id, month: currentMonth, baseAmount: base, revenueShare: revShare, uptimeBonus: uptime,
        campaignBonus: camp, complianceBonus: compliance, servicePenalty: penalty,
        totalAmount: base + revShare + uptime + camp + compliance - penalty, activeDays: randInt(15, 28),
        screenUptimePct: randInt(70, 98), status: pick(0.3) ? 'paid' : 'pending',
      },
    })
  }

  // Owner earnings
  for (const o of owners) {
    await db.ownerEarning.create({
      data: {
        ownerId: o.id, month: currentMonth, revenueShare: randInt(400, 1200), totalAmount: randInt(400, 1200), status: 'pending',
      },
    })
  }

  // 13. Payouts
  for (const d of drivers) {
    if (pick(0.4)) {
      await db.payout.create({
        data: {
          payoutRef: `PAY-${randomBytes(4).toString('hex').toUpperCase()}`, recipientType: 'driver', driverId: d.id,
          month: currentMonth, amount: randInt(800, 2000), method: 'upi', status: pick(0.5) ? 'paid' : 'pending',
          processedAt: pick(0.5) ? new Date() : null,
        },
      })
    }
  }

  // 14. Field engineers (3)
  const engineers = []
  for (let i = 0; i < 3; i++) {
    const e = await db.fieldEngineer.create({
      data: {
        name: `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`, mobile: genPhone(), email: `engineer${i + 1}@lakhirad.com`,
        city: rand(CITIES).name, specialization: pick(0.5) ? 'Hardware' : 'Software & Network', status: 'active',
      },
    })
    engineers.push(e)
  }

  // 15. Service tickets (5)
  const problems = ['Screen not turning on', 'Device overheating', 'No network connectivity', 'Playback stuttering', 'Screen flickering', 'Power supply issue']
  const priorities = ['low', 'medium', 'high', 'critical']
  for (let i = 0; i < 5; i++) {
    const dev = rand(devices)
    const veh = vehicles.find((v) => v.deviceId === dev.id)
    await db.serviceTicket.create({
      data: {
        ticketId: `TKT-${String(i + 1).padStart(4, '0')}`, deviceId: dev.id, vehicleId: veh?.id, driverId: veh?.driverId,
        problem: rand(problems), category: rand(['hardware', 'software', 'network', 'screen', 'power']),
        priority: rand(priorities), assignedEngineerId: rand(engineers).id, status: rand(['open', 'assigned', 'in_progress', 'resolved']),
        slaDueAt: new Date(Date.now() + randInt(4, 48) * 3600000),
      },
    })
  }

  // 16. Users — one per role
  const usersData = [
    { email: 'admin@lakhirad.com', name: 'Super Admin', role: 'super_admin' },
    { email: 'ops@lakhirad.com', name: 'Operations Admin', role: 'ops_admin' },
    { email: 'ads@lakhirad.com', name: 'Ads Manager', role: 'ads_manager' },
    { email: 'finance@lakhirad.com', name: 'Finance Admin', role: 'finance_admin' },
    { email: 'engineer@lakhirad.com', name: 'Service Engineer', role: 'service_engineer' },
    { email: 'advertiser@lakhirad.com', name: 'Advertiser User', role: 'advertiser', orgId: advertisers[0].organizationId },
    { email: 'owner@lakhirad.com', name: 'Vehicle Owner', role: 'vehicle_owner' },
    { email: 'driver@lakhirad.com', name: 'Driver User', role: 'driver' },
  ]
  const pw = await hashPassword('lakhirad123')
  for (const u of usersData) {
    await db.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, name: u.name, passwordHash: pw, role: u.role, organizationId: u.orgId || null, status: 'active' },
    })
  }

  console.log('Seed complete! Default login: admin@lakhirad.com / lakhirad123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
