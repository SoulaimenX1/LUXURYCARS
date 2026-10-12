function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") {
        r = Reflect.decorate(decorators, target, key, desc);
    } else {
        for(var i = decorators.length - 1; i >= 0; i--){
            if (d = decorators[i]) {
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
            }
        }
    }
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(metadataKey, metadataValue) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") {
        return Reflect.metadata(metadataKey, metadataValue);
    }
}
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { VehicleModel } from './vehicle-model.entity.js';
// Valeurs autorisées pour la transmission.
// Elles correspondent à l'ENUM PostgreSQL
// transmission_type.
export var TransmissionType = /*#__PURE__*/ function(TransmissionType) {
    TransmissionType["AUTOMATIC"] = "automatic";
    TransmissionType["MANUAL"] = "manual";
    TransmissionType["SEMI_AUTOMATIC"] = "semi_automatic";
    return TransmissionType;
}({});
// Valeurs autorisées pour le carburant.
// Elles correspondent à l'ENUM fuel_type.
export var FuelType = /*#__PURE__*/ function(FuelType) {
    FuelType["PETROL"] = "petrol";
    FuelType["DIESEL"] = "diesel";
    FuelType["HYBRID"] = "hybrid";
    FuelType["PLUG_IN_HYBRID"] = "plug_in_hybrid";
    FuelType["ELECTRIC"] = "electric";
    return FuelType;
}({});
// Statut administratif de la voiture.
// Une réservation ou une location sera
// gérée séparément, à partir des dates.
export var VehicleStatus = /*#__PURE__*/ function(VehicleStatus) {
    VehicleStatus["ACTIVE"] = "active";
    VehicleStatus["MAINTENANCE"] = "maintenance";
    VehicleStatus["RETIRED"] = "retired";
    return VehicleStatus;
}({});
export class Vehicle {
}
_ts_decorate([
    PrimaryColumn({
        type: 'uuid',
        default: ()=>'gen_random_uuid()'
    }),
    _ts_metadata("design:type", String)
], Vehicle.prototype, "id", void 0);
_ts_decorate([
    Column({
        name: 'model_id',
        type: 'uuid'
    }),
    _ts_metadata("design:type", String)
], Vehicle.prototype, "modelId", void 0);
_ts_decorate([
    ManyToOne(()=>VehicleModel, {
        nullable: false
    }),
    JoinColumn({
        name: 'model_id'
    }),
    _ts_metadata("design:type", typeof VehicleModel === "undefined" ? Object : VehicleModel)
], Vehicle.prototype, "model", void 0);
_ts_decorate([
    Column({
        name: 'manufacture_year',
        type: 'smallint'
    }),
    _ts_metadata("design:type", Number)
], Vehicle.prototype, "manufactureYear", void 0);
_ts_decorate([
    Column({
        name: 'license_plate',
        type: 'varchar',
        length: 20,
        unique: true
    }),
    _ts_metadata("design:type", String)
], Vehicle.prototype, "licensePlate", void 0);
_ts_decorate([
    Column({
        name: 'vin',
        type: 'char',
        length: 17,
        unique: true
    }),
    _ts_metadata("design:type", String)
], Vehicle.prototype, "vin", void 0);
_ts_decorate([
    Column({
        name: 'color',
        type: 'varchar',
        length: 40,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], Vehicle.prototype, "color", void 0);
_ts_decorate([
    Column({
        name: 'transmission',
        type: 'enum',
        enum: TransmissionType,
        enumName: 'transmission_type'
    }),
    _ts_metadata("design:type", String)
], Vehicle.prototype, "transmission", void 0);
_ts_decorate([
    Column({
        name: 'fuel_type',
        type: 'enum',
        enum: FuelType,
        enumName: 'fuel_type'
    }),
    _ts_metadata("design:type", String)
], Vehicle.prototype, "fuelType", void 0);
_ts_decorate([
    Column({
        name: 'seats',
        type: 'smallint',
        default: 2
    }),
    _ts_metadata("design:type", Number)
], Vehicle.prototype, "seats", void 0);
_ts_decorate([
    Column({
        name: 'power_hp',
        type: 'smallint',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], Vehicle.prototype, "powerHp", void 0);
_ts_decorate([
    Column({
        name: 'daily_price',
        type: 'numeric',
        precision: 10,
        scale: 2
    }),
    _ts_metadata("design:type", String)
], Vehicle.prototype, "dailyPrice", void 0);
_ts_decorate([
    Column({
        name: 'security_deposit',
        type: 'numeric',
        precision: 10,
        scale: 2
    }),
    _ts_metadata("design:type", String)
], Vehicle.prototype, "securityDeposit", void 0);
_ts_decorate([
    Column({
        name: 'mileage_km',
        type: 'integer',
        default: 0
    }),
    _ts_metadata("design:type", Number)
], Vehicle.prototype, "mileageKm", void 0);
_ts_decorate([
    Column({
        name: 'description',
        type: 'text',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], Vehicle.prototype, "description", void 0);
_ts_decorate([
    Column({
        name: 'engine',
        type: 'varchar',
        length: 120,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], Vehicle.prototype, "engine", void 0);
_ts_decorate([
    Column({
        name: 'torque_nm',
        type: 'integer',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], Vehicle.prototype, "torqueNm", void 0);
_ts_decorate([
    Column({
        name: 'acceleration_0_100',
        type: 'numeric',
        precision: 4,
        scale: 1,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], Vehicle.prototype, "acceleration0To100", void 0);
_ts_decorate([
    Column({
        name: 'top_speed_kmh',
        type: 'smallint',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], Vehicle.prototype, "topSpeedKmh", void 0);
_ts_decorate([
    Column({
        name: 'consumption_l_100km',
        type: 'numeric',
        precision: 4,
        scale: 1,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], Vehicle.prototype, "consumptionL100km", void 0);
_ts_decorate([
    Column({
        name: 'is_special',
        type: 'boolean',
        default: false
    }),
    _ts_metadata("design:type", Boolean)
], Vehicle.prototype, "isSpecial", void 0);
_ts_decorate([
    Column({
        name: 'is_limited',
        type: 'boolean',
        default: false
    }),
    _ts_metadata("design:type", Boolean)
], Vehicle.prototype, "isLimited", void 0);
_ts_decorate([
    Column({
        name: 'edition_size',
        type: 'integer',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], Vehicle.prototype, "editionSize", void 0);
_ts_decorate([
    Column({
        name: 'announced_at',
        type: 'timestamptz',
        default: ()=>'now()'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], Vehicle.prototype, "announcedAt", void 0);
_ts_decorate([
    Column({
        name: 'status',
        type: 'enum',
        enum: VehicleStatus,
        enumName: 'vehicle_status',
        default: "active"
    }),
    _ts_metadata("design:type", String)
], Vehicle.prototype, "status", void 0);
_ts_decorate([
    Column({
        name: 'created_at',
        type: 'timestamptz',
        default: ()=>'now()'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], Vehicle.prototype, "createdAt", void 0);
_ts_decorate([
    Column({
        name: 'updated_at',
        type: 'timestamptz',
        default: ()=>'now()'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], Vehicle.prototype, "updatedAt", void 0);
Vehicle = _ts_decorate([
    Entity('vehicles')
], Vehicle);

//# sourceMappingURL=vehicle.entity.js.map