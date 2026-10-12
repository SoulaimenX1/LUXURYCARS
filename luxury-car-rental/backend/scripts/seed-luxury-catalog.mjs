// ============================================================
// Réinitialise et remplit le catalogue de voitures de luxe.
//
// Effet :
//   1. Supprime toutes les données du catalogue
//      (marques, modèles, catégories, voitures) AINSI QUE
//      les réservations/locations qui en dépendent.
//   2. Conserve les comptes utilisateurs et les profils clients.
//   3. Insère un catalogue réel de marques de luxe, avec de
//      vraies catégories et des caractéristiques réelles.
//   4. Génère les notifications « nouveau véhicule »,
//      « édition spéciale » et « édition limitée ».
//
// Utilisation (depuis le dossier backend/) :
//   node scripts/seed-luxury-catalog.mjs
//
// Le script est transactionnel : en cas d'erreur, rien
// n'est modifié.
// ============================================================

import 'dotenv/config';

import pg from 'pg';

import { populateVehicleImages } from './lib/vehicle-images.mjs';

const { Client } = pg;

// ============================================================
// 2. CATÉGORIES RÉELLES
// ============================================================

const CATEGORIES = [
  ['Sports Car', 'Driver-focused performance coupés and roadsters.'],
  ['Supercar', 'Mid-engined exotics built for speed and presence.'],
  ['Hypercar', 'Extreme, low-volume machines at the top of the market.'],
  ['Grand Tourer', 'Powerful, comfortable cars built for long journeys.'],
  ['Luxury Sedan', 'Chauffeured saloons and executive four-doors.'],
  ['Luxury SUV', 'High-riding flagships combining space and prestige.'],
  ['Convertible', 'Open-top grand touring and roadsters.'],
  ['Electric Luxury', 'All-electric premium vehicles and grand tourers.'],
];

// ============================================================
// CATALOGUE
// ============================================================
//
// Chaque entrée décrit un véhicule réel : marque, modèle,
// catégorie, caractéristiques et tarifs de location.

const VEHICLES = [
  // ---------------------------------------------------------
  // FERRARI
  // ---------------------------------------------------------
  { brand: 'Ferrari', model: 'SF90 Stradale', category: 'Supercar', year: 2023, color: 'Rosso Corsa', transmission: 'semi_automatic', fuel: 'plug_in_hybrid', seats: 2, powerHp: 1000, engine: '4.0L V8 plug-in hybrid', torqueNm: 800, accel: 2.5, topSpeed: 340, consumption: 6.1, dailyPrice: 4900, deposit: 15000, mileage: 4200, description: "Ferrari's 1000 hp plug-in hybrid supercar." },
  { brand: 'Ferrari', model: '296 GTB', category: 'Supercar', year: 2023, color: 'Giallo Modena', transmission: 'semi_automatic', fuel: 'plug_in_hybrid', seats: 2, powerHp: 830, engine: '3.0L V6 plug-in hybrid', torqueNm: 740, accel: 2.9, topSpeed: 330, consumption: 6.4, dailyPrice: 3900, deposit: 12000, mileage: 6800, description: 'Compact V6 hybrid berlinetta with race-bred handling.' },
  { brand: 'Ferrari', model: 'Roma', category: 'Grand Tourer', year: 2022, color: 'Grigio Titanio', transmission: 'semi_automatic', fuel: 'petrol', seats: 2, powerHp: 620, engine: '3.9L V8', torqueNm: 760, accel: 3.4, topSpeed: 320, consumption: 11.2, dailyPrice: 3200, deposit: 9000, mileage: 12500, description: 'Timeless front-engined grand tourer elegance.' },
  { brand: 'Ferrari', model: 'Portofino M', category: 'Convertible', year: 2022, color: 'Rosso Portofino', transmission: 'semi_automatic', fuel: 'petrol', seats: 2, powerHp: 620, engine: '3.9L V8', torqueNm: 760, accel: 3.5, topSpeed: 320, consumption: 11.4, dailyPrice: 2900, deposit: 9000, mileage: 15800, description: 'Retractable-hardtop GT with everyday usability.' },
  { brand: 'Ferrari', model: '812 Superfast', category: 'Grand Tourer', year: 2021, color: 'Blu Tour de France', transmission: 'semi_automatic', fuel: 'petrol', seats: 2, powerHp: 800, engine: '6.5L V12', torqueNm: 718, accel: 2.9, topSpeed: 340, consumption: 14.9, dailyPrice: 4200, deposit: 12000, mileage: 21000, description: 'Naturally aspirated V12 grand tourer.' },
  { brand: 'Ferrari', model: 'Purosangue', category: 'Luxury SUV', year: 2024, color: 'Nero Daytona', transmission: 'automatic', fuel: 'petrol', seats: 4, powerHp: 725, engine: '6.5L V12', torqueNm: 716, accel: 3.3, topSpeed: 310, consumption: 17.3, dailyPrice: 3800, deposit: 12000, mileage: 5100, description: "Ferrari's V12 four-door, four-seat luxury SUV." },

  // ---------------------------------------------------------
  // LAMBORGHINI
  // ---------------------------------------------------------
  { brand: 'Lamborghini', model: 'Revuelto', category: 'Hypercar', year: 2024, color: 'Verde Mantis', transmission: 'automatic', fuel: 'plug_in_hybrid', seats: 2, powerHp: 1015, engine: '6.5L V12 plug-in hybrid', torqueNm: 725, accel: 2.5, topSpeed: 350, consumption: 10.7, dailyPrice: 5200, deposit: 18000, mileage: 2100, description: 'V12 hybrid flagship with 1015 hp.', special: true },
  { brand: 'Lamborghini', model: 'Huracán EVO', category: 'Supercar', year: 2022, color: 'Arancio Borealis', transmission: 'automatic', fuel: 'petrol', seats: 2, powerHp: 640, engine: '5.2L V10', torqueNm: 600, accel: 2.9, topSpeed: 325, consumption: 13.5, dailyPrice: 2800, deposit: 9000, mileage: 9800, description: 'Naturally aspirated V10 with razor-sharp responses.' },
  { brand: 'Lamborghini', model: 'Huracán Sterrato', category: 'Supercar', year: 2023, color: 'Verde Gea', transmission: 'automatic', fuel: 'petrol', seats: 2, powerHp: 610, engine: '5.2L V10', torqueNm: 565, accel: 3.4, topSpeed: 260, consumption: 13.9, dailyPrice: 3100, deposit: 10000, mileage: 3200, description: 'All-terrain V10 supercar in a limited run.', limited: true, editionSize: 1499 },
  { brand: 'Lamborghini', model: 'Aventador SVJ', category: 'Hypercar', year: 2021, color: 'Nero Aldebaran', transmission: 'automatic', fuel: 'petrol', seats: 2, powerHp: 770, engine: '6.5L V12', torqueNm: 720, accel: 2.8, topSpeed: 350, consumption: 19.6, dailyPrice: 4500, deposit: 16000, mileage: 14200, description: 'Track-focused V12 with active aerodynamics.', limited: true, editionSize: 900 },
  { brand: 'Lamborghini', model: 'Urus Performante', category: 'Luxury SUV', year: 2023, color: 'Grigio Keres', transmission: 'automatic', fuel: 'petrol', seats: 5, powerHp: 666, engine: '4.0L V8', torqueNm: 850, accel: 3.3, topSpeed: 306, consumption: 14.1, dailyPrice: 2200, deposit: 8000, mileage: 7600, description: 'Super-SUV combining V8 power and daily comfort.' },
  { brand: 'Lamborghini', model: 'Countach LPI 800-4', category: 'Hypercar', year: 2022, color: 'Bianco Siderale', transmission: 'automatic', fuel: 'hybrid', seats: 2, powerHp: 814, engine: '6.5L V12 hybrid', torqueNm: 720, accel: 2.8, topSpeed: 355, consumption: 16.5, dailyPrice: 6000, deposit: 20000, mileage: 900, description: 'Retro-inspired hybrid tribute to the Countach.', limited: true, editionSize: 112 },

  // ---------------------------------------------------------
  // McLAREN
  // ---------------------------------------------------------
  { brand: 'McLaren', model: '720S', category: 'Supercar', year: 2022, color: 'Volcano Yellow', transmission: 'automatic', fuel: 'petrol', seats: 2, powerHp: 720, engine: '4.0L V8', torqueNm: 770, accel: 2.9, topSpeed: 341, consumption: 12.2, dailyPrice: 3200, deposit: 10000, mileage: 8800, description: 'Carbon-tub supercar with telepathic handling.' },
  { brand: 'McLaren', model: 'Artura', category: 'Supercar', year: 2023, color: 'Papaya Spark', transmission: 'automatic', fuel: 'plug_in_hybrid', seats: 2, powerHp: 680, engine: '3.0L V6 plug-in hybrid', torqueNm: 720, accel: 3.0, topSpeed: 330, consumption: 8.1, dailyPrice: 2700, deposit: 9000, mileage: 5400, description: 'Lightweight V6 hybrid supercar.' },
  { brand: 'McLaren', model: '765LT', category: 'Supercar', year: 2021, color: 'Silica White', transmission: 'automatic', fuel: 'petrol', seats: 2, powerHp: 765, engine: '4.0L V8', torqueNm: 800, accel: 2.8, topSpeed: 330, consumption: 12.7, dailyPrice: 4100, deposit: 14000, mileage: 6100, description: 'Longtail edition with extreme downforce.', limited: true, editionSize: 765 },
  { brand: 'McLaren', model: 'GT', category: 'Grand Tourer', year: 2022, color: 'Onyx Black', transmission: 'automatic', fuel: 'petrol', seats: 2, powerHp: 620, engine: '4.0L V8', torqueNm: 630, accel: 3.2, topSpeed: 326, consumption: 12.1, dailyPrice: 2600, deposit: 8000, mileage: 11400, description: 'Grand tourer built for continent-crossing comfort.' },

  // ---------------------------------------------------------
  // PORSCHE
  // ---------------------------------------------------------
  { brand: 'Porsche', model: '911 Turbo S', category: 'Sports Car', year: 2023, color: 'GT Silver', transmission: 'automatic', fuel: 'petrol', seats: 4, powerHp: 650, engine: '3.8L flat-six twin-turbo', torqueNm: 800, accel: 2.7, topSpeed: 330, consumption: 11.1, dailyPrice: 1900, deposit: 6000, mileage: 6900, description: 'All-weather performance flagship of the 911 range.' },
  { brand: 'Porsche', model: '911 GT3', category: 'Sports Car', year: 2022, color: 'Guards Red', transmission: 'automatic', fuel: 'petrol', seats: 2, powerHp: 510, engine: '4.0L flat-six', torqueNm: 470, accel: 3.4, topSpeed: 318, consumption: 12.4, dailyPrice: 1800, deposit: 6000, mileage: 8300, description: 'Naturally aspirated track weapon with motorsport DNA.' },
  { brand: 'Porsche', model: '911 GT3 RS', category: 'Sports Car', year: 2023, color: 'Lizard Green', transmission: 'automatic', fuel: 'petrol', seats: 2, powerHp: 525, engine: '4.0L flat-six', torqueNm: 465, accel: 3.2, topSpeed: 296, consumption: 13.4, dailyPrice: 2400, deposit: 8000, mileage: 2400, description: 'Aerodynamics-focused homologation special.', special: true },
  { brand: 'Porsche', model: 'Taycan Turbo S', category: 'Electric Luxury', year: 2023, color: 'Frozen Blue', transmission: 'automatic', fuel: 'electric', seats: 4, powerHp: 761, engine: 'Dual electric motors', torqueNm: 1050, accel: 2.8, topSpeed: 260, consumption: null, dailyPrice: 1500, deposit: 5000, mileage: 7900, description: 'All-electric four-door with 800-volt architecture.' },
  { brand: 'Porsche', model: 'Panamera Turbo S', category: 'Luxury Sedan', year: 2022, color: 'Jet Black', transmission: 'automatic', fuel: 'petrol', seats: 4, powerHp: 630, engine: '4.0L V8 twin-turbo', torqueNm: 820, accel: 3.1, topSpeed: 315, consumption: 11.6, dailyPrice: 1300, deposit: 5000, mileage: 16800, description: 'Executive sedan merging comfort and pace.' },
  { brand: 'Porsche', model: 'Cayenne Turbo GT', category: 'Luxury SUV', year: 2023, color: 'Carrara White', transmission: 'automatic', fuel: 'petrol', seats: 5, powerHp: 640, engine: '4.0L V8 twin-turbo', torqueNm: 850, accel: 3.3, topSpeed: 300, consumption: 12.7, dailyPrice: 1200, deposit: 4000, mileage: 9200, description: 'High-performance SUV with sports-car agility.' },
  { brand: 'Porsche', model: '718 Cayman GT4 RS', category: 'Sports Car', year: 2023, color: 'Racing Yellow', transmission: 'automatic', fuel: 'petrol', seats: 2, powerHp: 500, engine: '4.0L flat-six', torqueNm: 450, accel: 3.4, topSpeed: 315, consumption: 12.7, dailyPrice: 1600, deposit: 6000, mileage: 3100, description: "Mid-engined purist's machine." },
  { brand: 'Porsche', model: '918 Spyder', category: 'Hypercar', year: 2015, color: 'Liquid Metal Silver', transmission: 'automatic', fuel: 'plug_in_hybrid', seats: 2, powerHp: 887, engine: '4.6L V8 plug-in hybrid', torqueNm: 800, accel: 2.6, topSpeed: 345, consumption: 3.1, dailyPrice: 6500, deposit: 25000, mileage: 9600, description: 'Pioneering V8 hybrid hypercar.', limited: true, editionSize: 918 },

  // ---------------------------------------------------------
  // ASTON MARTIN
  // ---------------------------------------------------------
  { brand: 'Aston Martin', model: 'DBS Superleggera', category: 'Grand Tourer', year: 2022, color: 'Racing Green', transmission: 'automatic', fuel: 'petrol', seats: 4, powerHp: 725, engine: '5.2L V12 twin-turbo', torqueNm: 900, accel: 3.4, topSpeed: 340, consumption: 12.4, dailyPrice: 2600, deposit: 10000, mileage: 13200, description: 'Brutish V12 grand tourer with a light carbon body.' },
  { brand: 'Aston Martin', model: 'DB12', category: 'Grand Tourer', year: 2024, color: 'Satin Sepang Bronze', transmission: 'automatic', fuel: 'petrol', seats: 4, powerHp: 680, engine: '4.0L V8 twin-turbo', torqueNm: 800, accel: 3.6, topSpeed: 325, consumption: 12.2, dailyPrice: 2400, deposit: 9000, mileage: 1800, description: 'Modern super tourer with reworked V8.' },
  { brand: 'Aston Martin', model: 'Vantage', category: 'Sports Car', year: 2023, color: 'Onyx Black', transmission: 'automatic', fuel: 'petrol', seats: 2, powerHp: 665, engine: '4.0L V8 twin-turbo', torqueNm: 800, accel: 3.5, topSpeed: 325, consumption: 12.4, dailyPrice: 1900, deposit: 7000, mileage: 4200, description: 'Compact, driver-focused sports car.' },
  { brand: 'Aston Martin', model: 'Valkyrie', category: 'Hypercar', year: 2022, color: 'Verde Tracy', transmission: 'automatic', fuel: 'hybrid', seats: 2, powerHp: 1160, engine: '6.5L V12 hybrid', torqueNm: 900, accel: 2.5, topSpeed: 350, consumption: 13.9, dailyPrice: 12000, deposit: 50000, mileage: 700, description: 'Formula One-inspired road hypercar.', limited: true, editionSize: 150 },
  { brand: 'Aston Martin', model: 'DBX707', category: 'Luxury SUV', year: 2023, color: 'Satin Xenon Grey', transmission: 'automatic', fuel: 'petrol', seats: 5, powerHp: 707, engine: '4.0L V8 twin-turbo', torqueNm: 900, accel: 3.3, topSpeed: 310, consumption: 14.2, dailyPrice: 1700, deposit: 6000, mileage: 6300, description: "The world's most powerful luxury SUV." },

  // ---------------------------------------------------------
  // BENTLEY
  // ---------------------------------------------------------
  { brand: 'Bentley', model: 'Continental GT Speed', category: 'Grand Tourer', year: 2023, color: 'Beluga Black', transmission: 'automatic', fuel: 'petrol', seats: 4, powerHp: 650, engine: '6.0L W12 twin-turbo', torqueNm: 900, accel: 3.6, topSpeed: 335, consumption: 12.9, dailyPrice: 1900, deposit: 6000, mileage: 7400, description: 'W12 grand tourer with effortless pace.' },
  { brand: 'Bentley', model: 'Bentayga Speed', category: 'Luxury SUV', year: 2022, color: 'Moonbeam', transmission: 'automatic', fuel: 'petrol', seats: 5, powerHp: 635, engine: '6.0L W12 twin-turbo', torqueNm: 900, accel: 3.9, topSpeed: 306, consumption: 13.1, dailyPrice: 1600, deposit: 6000, mileage: 9900, description: 'Hand-built ultra-luxury SUV.' },
  { brand: 'Bentley', model: 'Flying Spur', category: 'Luxury Sedan', year: 2023, color: 'Sequin Blue', transmission: 'automatic', fuel: 'petrol', seats: 5, powerHp: 635, engine: '6.0L W12 twin-turbo', torqueNm: 900, accel: 3.8, topSpeed: 333, consumption: 13.4, dailyPrice: 1800, deposit: 6000, mileage: 5700, description: 'Four-door flagship with limousine comfort.' },
  { brand: 'Bentley', model: 'Continental GTC', category: 'Convertible', year: 2022, color: 'Ice', transmission: 'automatic', fuel: 'petrol', seats: 4, powerHp: 550, engine: '4.0L V8 twin-turbo', torqueNm: 770, accel: 4.1, topSpeed: 318, consumption: 12.6, dailyPrice: 1700, deposit: 6000, mileage: 8200, description: 'Open-top grand touring in supreme comfort.' },

  // ---------------------------------------------------------
  // ROLLS-ROYCE
  // ---------------------------------------------------------
  { brand: 'Rolls-Royce', model: 'Phantom', category: 'Luxury Sedan', year: 2023, color: 'English White', transmission: 'automatic', fuel: 'petrol', seats: 5, powerHp: 571, engine: '6.75L V12 twin-turbo', torqueNm: 900, accel: 5.3, topSpeed: 250, consumption: 15.2, dailyPrice: 2500, deposit: 10000, mileage: 4500, description: 'The definitive statement of automotive luxury.' },
  { brand: 'Rolls-Royce', model: 'Ghost', category: 'Luxury Sedan', year: 2023, color: 'Black Diamond', transmission: 'automatic', fuel: 'petrol', seats: 5, powerHp: 563, engine: '6.75L V12 twin-turbo', torqueNm: 850, accel: 4.8, topSpeed: 250, consumption: 14.9, dailyPrice: 2000, deposit: 8000, mileage: 7600, description: 'Post-opulent saloon with silent V12 power.' },
  { brand: 'Rolls-Royce', model: 'Cullinan', category: 'Luxury SUV', year: 2023, color: 'Arctic White', transmission: 'automatic', fuel: 'petrol', seats: 5, powerHp: 571, engine: '6.75L V12 twin-turbo', torqueNm: 850, accel: 5.2, topSpeed: 250, consumption: 15.6, dailyPrice: 2200, deposit: 10000, mileage: 6800, description: 'Effortless everywhere: the all-terrain Rolls-Royce.' },
  { brand: 'Rolls-Royce', model: 'Dawn', category: 'Convertible', year: 2021, color: 'Midnight Sapphire', transmission: 'automatic', fuel: 'petrol', seats: 4, powerHp: 563, engine: '6.6L V12 twin-turbo', torqueNm: 780, accel: 5.0, topSpeed: 250, consumption: 14.4, dailyPrice: 1900, deposit: 8000, mileage: 14800, description: 'Coachbuilt drophead grand tourer.' },
  { brand: 'Rolls-Royce', model: 'Spectre', category: 'Electric Luxury', year: 2024, color: 'Chartreuse', transmission: 'automatic', fuel: 'electric', seats: 4, powerHp: 585, engine: 'Dual electric motors', torqueNm: 900, accel: 4.5, topSpeed: 250, consumption: null, dailyPrice: 2800, deposit: 12000, mileage: 2600, description: "Rolls-Royce's all-electric super coupe." },

  // ---------------------------------------------------------
  // BUGATTI
  // ---------------------------------------------------------
  { brand: 'Bugatti', model: 'Chiron', category: 'Hypercar', year: 2021, color: 'Bleu Royal', transmission: 'automatic', fuel: 'petrol', seats: 2, powerHp: 1500, engine: '8.0L W16 quad-turbo', torqueNm: 1600, accel: 2.4, topSpeed: 420, consumption: 22.5, dailyPrice: 20000, deposit: 80000, mileage: 3400, description: 'Quad-turbo W16 hypercar icon.', limited: true, editionSize: 500 },
  { brand: 'Bugatti', model: 'Chiron Super Sport 300+', category: 'Hypercar', year: 2022, color: 'Jet Black', transmission: 'automatic', fuel: 'petrol', seats: 2, powerHp: 1600, engine: '8.0L W16 quad-turbo', torqueNm: 1600, accel: 2.3, topSpeed: 440, consumption: 22.9, dailyPrice: 25000, deposit: 100000, mileage: 900, description: 'The 300+ mph record-breaking Chiron.', limited: true, editionSize: 30 },

  // ---------------------------------------------------------
  // MERCEDES-MAYBACH
  // ---------------------------------------------------------
  { brand: 'Mercedes-Maybach', model: 'S 680', category: 'Luxury Sedan', year: 2023, color: 'Obsidian Black', transmission: 'automatic', fuel: 'petrol', seats: 5, powerHp: 612, engine: '6.0L V12 twin-turbo', torqueNm: 900, accel: 4.5, topSpeed: 250, consumption: 14.9, dailyPrice: 1500, deposit: 6000, mileage: 5200, description: 'Ultimate chauffeured saloon with V12 refinement.' },
  { brand: 'Mercedes-Maybach', model: 'GLS 600', category: 'Luxury SUV', year: 2023, color: 'Sodalite Blue', transmission: 'automatic', fuel: 'petrol', seats: 5, powerHp: 558, engine: '4.0L V8 twin-turbo', torqueNm: 730, accel: 4.9, topSpeed: 250, consumption: 12.6, dailyPrice: 1400, deposit: 5000, mileage: 6400, description: 'First-class travel in a full-size SUV.' },

  // ---------------------------------------------------------
  // MERCEDES-AMG
  // ---------------------------------------------------------
  { brand: 'Mercedes-AMG', model: 'GT 63 S', category: 'Sports Car', year: 2022, color: 'Selenite Grey', transmission: 'automatic', fuel: 'petrol', seats: 4, powerHp: 639, engine: '4.0L V8 twin-turbo', torqueNm: 900, accel: 3.2, topSpeed: 315, consumption: 12.5, dailyPrice: 1300, deposit: 5000, mileage: 11200, description: 'Four-door coupe with brutal V8 thrust.' },
  { brand: 'Mercedes-AMG', model: 'SL 63', category: 'Convertible', year: 2023, color: 'Hyperblue', transmission: 'automatic', fuel: 'petrol', seats: 2, powerHp: 585, engine: '4.0L V8 twin-turbo', torqueNm: 800, accel: 3.6, topSpeed: 315, consumption: 12.7, dailyPrice: 1200, deposit: 5000, mileage: 4600, description: 'Iconic roadster reborn with AMG power.' },
  { brand: 'Mercedes-AMG', model: 'G 63', category: 'Luxury SUV', year: 2023, color: 'Manufaktur Green', transmission: 'automatic', fuel: 'petrol', seats: 5, powerHp: 585, engine: '4.0L V8 twin-turbo', torqueNm: 850, accel: 4.5, topSpeed: 220, consumption: 15.9, dailyPrice: 1100, deposit: 5000, mileage: 12800, description: 'Unmistakable boxy icon with genuine off-road ability.' },
  { brand: 'Mercedes-AMG', model: 'ONE', category: 'Hypercar', year: 2023, color: 'Obsidian Black', transmission: 'automatic', fuel: 'hybrid', seats: 1, powerHp: 1063, engine: '1.6L V6 hybrid', torqueNm: 900, accel: 2.9, topSpeed: 352, consumption: 8.6, dailyPrice: 9000, deposit: 40000, mileage: 1500, description: 'Formula One powertrain in a road-legal hypercar.', limited: true, editionSize: 275 },

  // ---------------------------------------------------------
  // BMW
  // ---------------------------------------------------------
  { brand: 'BMW', model: 'M8 Competition', category: 'Grand Tourer', year: 2022, color: 'Frozen Marina Bay Blue', transmission: 'automatic', fuel: 'petrol', seats: 4, powerHp: 625, engine: '4.4L V8 twin-turbo', torqueNm: 750, accel: 3.3, topSpeed: 305, consumption: 11.5, dailyPrice: 1100, deposit: 4000, mileage: 13500, description: 'V8 grand tourer with racetrack composure.' },
  { brand: 'BMW', model: 'M5 CS', category: 'Luxury Sedan', year: 2022, color: 'Frozen Deep Green', transmission: 'automatic', fuel: 'petrol', seats: 5, powerHp: 635, engine: '4.4L V8 twin-turbo', torqueNm: 750, accel: 3.0, topSpeed: 305, consumption: 11.1, dailyPrice: 1000, deposit: 4000, mileage: 12300, description: 'Lightened, sharpened super-sedan.', limited: true, editionSize: 1000 },
  { brand: 'BMW', model: 'i7 M70', category: 'Electric Luxury', year: 2024, color: 'Oxide Grey', transmission: 'automatic', fuel: 'electric', seats: 5, powerHp: 660, engine: 'Dual electric motors', torqueNm: 1100, accel: 3.7, topSpeed: 250, consumption: null, dailyPrice: 1000, deposit: 4000, mileage: 3900, description: 'All-electric flagship luxury sedan.' },
  { brand: 'BMW', model: 'i8 Roadster', category: 'Convertible', year: 2020, color: 'E-Copper', transmission: 'automatic', fuel: 'plug_in_hybrid', seats: 2, powerHp: 374, engine: '1.5L three-cylinder plug-in hybrid', torqueNm: 570, accel: 4.6, topSpeed: 250, consumption: 2.1, dailyPrice: 800, deposit: 3000, mileage: 18300, description: 'Futuristic plug-in hybrid roadster.' },

  // ---------------------------------------------------------
  // AUDI
  // ---------------------------------------------------------
  { brand: 'Audi', model: 'R8 V10 Performance', category: 'Supercar', year: 2022, color: 'Daytona Grey', transmission: 'automatic', fuel: 'petrol', seats: 2, powerHp: 620, engine: '5.2L V10', torqueNm: 580, accel: 3.1, topSpeed: 331, consumption: 13.1, dailyPrice: 1700, deposit: 6000, mileage: 10500, description: 'Mid-engined V10 with everyday usability.' },
  { brand: 'Audi', model: 'RS e-tron GT', category: 'Electric Luxury', year: 2023, color: 'Kemora Grey', transmission: 'automatic', fuel: 'electric', seats: 4, powerHp: 646, engine: 'Dual electric motors', torqueNm: 830, accel: 3.3, topSpeed: 250, consumption: null, dailyPrice: 1100, deposit: 4000, mileage: 7300, description: 'Four-door electric GT with quattro traction.' },
  { brand: 'Audi', model: 'RS Q8', category: 'Luxury SUV', year: 2022, color: 'Mythos Black', transmission: 'automatic', fuel: 'petrol', seats: 5, powerHp: 600, engine: '4.0L V8 twin-turbo', torqueNm: 800, accel: 3.8, topSpeed: 305, consumption: 13.2, dailyPrice: 950, deposit: 4000, mileage: 11800, description: 'Coupe-styled performance SUV.' },

  // ---------------------------------------------------------
  // MASERATI
  // ---------------------------------------------------------
  { brand: 'Maserati', model: 'MC20', category: 'Supercar', year: 2023, color: 'Bianco Audace', transmission: 'automatic', fuel: 'petrol', seats: 2, powerHp: 630, engine: '3.0L V6 twin-turbo', torqueNm: 730, accel: 2.9, topSpeed: 325, consumption: 11.6, dailyPrice: 2400, deposit: 9000, mileage: 4400, description: 'Nettuno V6 supercar with a carbon monocoque.' },
  { brand: 'Maserati', model: 'GranTurismo Folgore', category: 'Electric Luxury', year: 2024, color: 'Rame Folgore', transmission: 'automatic', fuel: 'electric', seats: 4, powerHp: 761, engine: 'Triple electric motors', torqueNm: 1350, accel: 2.7, topSpeed: 320, consumption: null, dailyPrice: 1600, deposit: 6000, mileage: 2200, description: 'All-electric grand tourer with 800-volt tech.' },
  { brand: 'Maserati', model: 'Grecale Trofeo', category: 'Luxury SUV', year: 2023, color: 'Blu Intenso', transmission: 'automatic', fuel: 'petrol', seats: 5, powerHp: 530, engine: '3.0L V6 twin-turbo', torqueNm: 620, accel: 3.8, topSpeed: 285, consumption: 11.2, dailyPrice: 850, deposit: 3000, mileage: 8900, description: 'Compact luxury SUV with V6 character.' },

  // ---------------------------------------------------------
  // LEXUS
  // ---------------------------------------------------------
  { brand: 'Lexus', model: 'LC 500', category: 'Grand Tourer', year: 2022, color: 'Structural Blue', transmission: 'automatic', fuel: 'petrol', seats: 4, powerHp: 471, engine: '5.0L V8', torqueNm: 540, accel: 4.7, topSpeed: 270, consumption: 12.2, dailyPrice: 800, deposit: 3000, mileage: 15200, description: 'Naturally aspirated V8 coupe with sculpted design.' },
  { brand: 'Lexus', model: 'LS 500h', category: 'Luxury Sedan', year: 2022, color: 'Manganese Luster', transmission: 'automatic', fuel: 'hybrid', seats: 5, powerHp: 354, engine: '3.5L V6 hybrid', torqueNm: 350, accel: 5.4, topSpeed: 250, consumption: 6.7, dailyPrice: 700, deposit: 3000, mileage: 19100, description: 'Serene hybrid flagship sedan.' },
];

// ============================================================
// CONNEXION POSTGRESQL
// ============================================================

for (const key of [
  'DB_HOST',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
]) {
  if (!process.env[key]) {
    console.error(`✗ Variable manquante : ${key}.`);
    console.error(
      '  Lancez la commande depuis le dossier backend/ pour que dotenv lise .env.',
    );
    process.exit(1);
  }
}

const client = new pg.Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

await client.connect();

console.log(
  `→ Connecté à ${process.env.DB_DATABASE} sur ${process.env.DB_HOST}`,
);

// ------------------------------------------------------------
// Construire un VIN valide de 17 caractères.
// Lettres autorisées : pas de I, O, Q.
// ------------------------------------------------------------

function makeVin(index) {
  return `LUXCAR${String(index).padStart(11, '0')}`;
}

function makePlate(index) {
  return `LC-${String(index).padStart(4, '0')}`;
}

try {
  await client.query('BEGIN');

  // ----------------------------------------------------------
  // 1. PURGER LE CATALOGUE ET LES RÉSERVATIONS DÉPENDANTES
  // ----------------------------------------------------------

  console.log(
    '→ Suppression de l\'ancien catalogue et des réservations...',
  );

  await client.query(`
    TRUNCATE TABLE
      notifications,
      reservations,
      vehicle_unavailability,
      vehicle_images,
      vehicles,
      vehicle_models,
      categories,
      brands
    RESTART IDENTITY CASCADE
  `);

  // ----------------------------------------------------------
  // 2. CATÉGORIES
  // ----------------------------------------------------------

  const categoryIds = new Map();

  for (const [name, description] of CATEGORIES) {
    const result = await client.query(
      `INSERT INTO categories (name, description)
       VALUES ($1, $2)
       RETURNING id`,
      [name, description],
    );
    categoryIds.set(name, result.rows[0].id);
  }

  console.log(`✓ ${CATEGORIES.length} catégories insérées.`);

  // ----------------------------------------------------------
  // 3. MARQUES
  // ----------------------------------------------------------

  const brandNames = [...new Set(VEHICLES.map((v) => v.brand))].sort();
  const brandIds = new Map();

  for (const name of brandNames) {
    const result = await client.query(
      `INSERT INTO brands (name) VALUES ($1) RETURNING id`,
      [name],
    );
    brandIds.set(name, result.rows[0].id);
  }

  console.log(`✓ ${brandNames.length} marques insérées.`);

  // ----------------------------------------------------------
  // 4. MODÈLES
  // ----------------------------------------------------------

  const modelIds = new Map();

  for (const vehicle of VEHICLES) {
    const key = `${vehicle.brand}::${vehicle.model}`;

    if (modelIds.has(key)) {
      continue;
    }

    const result = await client.query(
      `INSERT INTO vehicle_models (brand_id, category_id, name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [
        brandIds.get(vehicle.brand),
        categoryIds.get(vehicle.category),
        vehicle.model,
      ],
    );

    modelIds.set(key, result.rows[0].id);
  }

  console.log(`✓ ${modelIds.size} modèles insérés.`);

  // ----------------------------------------------------------
  // 5. VOITURES
  // ----------------------------------------------------------

  const insertedVehicles = [];
  let index = 0;

  for (const vehicle of VEHICLES) {
    index += 1;

    const result = await client.query(
      `INSERT INTO vehicles (
         model_id,
         manufacture_year,
         license_plate,
         vin,
         color,
         transmission,
         fuel_type,
         seats,
         power_hp,
         daily_price,
         security_deposit,
         mileage_km,
         description,
         engine,
         torque_nm,
         acceleration_0_100,
         top_speed_kmh,
         consumption_l_100km,
         is_special,
         is_limited,
         edition_size
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
         $14, $15, $16, $17, $18, $19, $20, $21
       )
       RETURNING id`,
      [
        modelIds.get(`${vehicle.brand}::${vehicle.model}`),
        vehicle.year,
        makePlate(index),
        makeVin(index),
        vehicle.color,
        vehicle.transmission,
        vehicle.fuel,
        vehicle.seats,
        vehicle.powerHp,
        vehicle.dailyPrice,
        vehicle.deposit,
        vehicle.mileage,
        vehicle.description,
        vehicle.engine ?? null,
        vehicle.torqueNm ?? null,
        vehicle.accel ?? null,
        vehicle.topSpeed ?? null,
        vehicle.consumption ?? null,
        vehicle.special === true,
        vehicle.limited === true,
        vehicle.editionSize ?? null,
      ],
    );

    insertedVehicles.push({
      id: result.rows[0].id,
      brand: vehicle.brand,
      model: vehicle.model,
      special: vehicle.special === true,
      limited: vehicle.limited === true,
      editionSize: vehicle.editionSize ?? null,
    });
  }

  console.log(`✓ ${insertedVehicles.length} voitures insérées.`);

  // ----------------------------------------------------------
  // 6. NOTIFICATIONS
  // ----------------------------------------------------------
  //
  //  - Édition limitée  -> "limited_edition"
  //  - Édition spéciale -> "special_edition"
  //  - Dernières arrivées -> "new_vehicle"
  //
  // Les dates sont échelonnées pour alimenter le compteur
  // "non lues" du site.

  let notificationCount = 0;
  let dayOffset = 27;

  for (const vehicle of insertedVehicles) {
    let row = null;

    if (vehicle.limited) {
      row = {
        type: 'limited_edition',
        title: `Limited edition: ${vehicle.brand} ${vehicle.model}`,
        message:
          vehicle.editionSize !== null
            ? `Only ${vehicle.editionSize} produced worldwide. Now available in our collection.`
            : 'A rare, numbered edition now available in our collection.',
      };
    } else if (vehicle.special) {
      row = {
        type: 'special_edition',
        title: `Special edition: ${vehicle.brand} ${vehicle.model}`,
        message:
          'A special series has just joined the fleet.',
      };
    }

    if (row) {
      await client.query(
        `INSERT INTO notifications (type, title, message, vehicle_id, created_at)
         VALUES ($1, $2, $3, $4, now() - make_interval(days => $5))`,
        [row.type, row.title, row.message, vehicle.id, dayOffset],
      );
      notificationCount += 1;
      dayOffset = Math.max(2, dayOffset - 2);
    }
  }

  // Notifications "nouvelle voiture" pour les arrivées récentes.
  const recentArrivals = insertedVehicles
    .filter((vehicle) => !vehicle.special && !vehicle.limited)
    .slice(-6);

  let newOffset = 6;

  for (const vehicle of recentArrivals) {
    await client.query(
      `INSERT INTO notifications (type, title, message, vehicle_id, created_at)
       VALUES ('new_vehicle', $1, $2, $3, now() - make_interval(days => $4))`,
      [
        `New arrival: ${vehicle.brand} ${vehicle.model}`,
        'Just added to the Luxury Cars fleet.',
        vehicle.id,
        newOffset,
      ],
    );
    notificationCount += 1;
    newOffset = Math.max(0, newOffset - 1);
  }

  console.log(`✓ ${notificationCount} notifications créées.`);

  await client.query('COMMIT');

  // Photos réelles des véhicules (best effort : le seed ne
  // doit pas échouer si Wikipédia est indisponible).
  try {
    console.log('');
    console.log('→ Récupération des photos réelles des véhicules...');
    await populateVehicleImages(client);
  } catch (error) {
    console.warn(`  ! photos indisponibles : ${error.message}`);
  }

  console.log('');
  console.log('  ┌─────────────────────────────────────────┐');
  console.log('  │  CATALOGUE LUXE RÉINITIALISÉ            │');
  console.log('  └─────────────────────────────────────────┘');
  console.log(`  marques    : ${brandNames.length}`);
  console.log(`  modèles    : ${modelIds.size}`);
  console.log(`  voitures   : ${insertedVehicles.length}`);
  console.log(`  catégories : ${CATEGORIES.length}`);
  console.log(`  notifs     : ${notificationCount}`);
  console.log('');
} catch (error) {
  await client.query('ROLLBACK');
  console.error('✗ Erreur pendant le seed :', error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
