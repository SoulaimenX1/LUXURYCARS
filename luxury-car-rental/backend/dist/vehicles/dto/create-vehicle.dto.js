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
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { FuelType, TransmissionType } from '../entities/vehicle.entity.js';
// Ce DTO vérifie les données envoyées
// lors de la création d'une voiture.
export class CreateVehicleDto {
}
_ts_decorate([
    IsString(),
    Length(2, 80),
    Transform(({ value })=>typeof value === 'string' ? value.trim() : value),
    _ts_metadata("design:type", String)
], CreateVehicleDto.prototype, "brandName", void 0);
_ts_decorate([
    IsString(),
    Length(2, 100),
    Transform(({ value })=>typeof value === 'string' ? value.trim() : value),
    _ts_metadata("design:type", String)
], CreateVehicleDto.prototype, "modelName", void 0);
_ts_decorate([
    IsInt(),
    Min(1990),
    Max(2100),
    _ts_metadata("design:type", Number)
], CreateVehicleDto.prototype, "manufactureYear", void 0);
_ts_decorate([
    IsString(),
    Length(1, 20),
    Transform(({ value })=>typeof value === 'string' ? value.trim().toUpperCase() : value),
    _ts_metadata("design:type", String)
], CreateVehicleDto.prototype, "licensePlate", void 0);
_ts_decorate([
    IsString(),
    Matches(/^[A-HJ-NPR-Z0-9]{17}$/),
    Transform(({ value })=>typeof value === 'string' ? value.trim().toUpperCase() : value),
    _ts_metadata("design:type", String)
], CreateVehicleDto.prototype, "vin", void 0);
_ts_decorate([
    IsOptional(),
    IsString(),
    MaxLength(40),
    Transform(({ value })=>typeof value === 'string' ? value.trim() : value),
    _ts_metadata("design:type", String)
], CreateVehicleDto.prototype, "color", void 0);
_ts_decorate([
    IsEnum(TransmissionType),
    _ts_metadata("design:type", typeof TransmissionType === "undefined" ? Object : TransmissionType)
], CreateVehicleDto.prototype, "transmission", void 0);
_ts_decorate([
    IsEnum(FuelType),
    _ts_metadata("design:type", typeof FuelType === "undefined" ? Object : FuelType)
], CreateVehicleDto.prototype, "fuelType", void 0);
_ts_decorate([
    IsOptional(),
    IsInt(),
    Min(1),
    Max(9),
    _ts_metadata("design:type", Number)
], CreateVehicleDto.prototype, "seats", void 0);
_ts_decorate([
    IsOptional(),
    IsInt(),
    Min(1),
    _ts_metadata("design:type", Number)
], CreateVehicleDto.prototype, "powerHp", void 0);
_ts_decorate([
    IsNumber({
        maxDecimalPlaces: 2
    }),
    Min(0.01),
    _ts_metadata("design:type", Number)
], CreateVehicleDto.prototype, "dailyPrice", void 0);
_ts_decorate([
    IsNumber({
        maxDecimalPlaces: 2
    }),
    Min(0),
    _ts_metadata("design:type", Number)
], CreateVehicleDto.prototype, "securityDeposit", void 0);
_ts_decorate([
    IsOptional(),
    IsInt(),
    Min(0),
    _ts_metadata("design:type", Number)
], CreateVehicleDto.prototype, "mileageKm", void 0);
_ts_decorate([
    IsOptional(),
    IsString(),
    _ts_metadata("design:type", String)
], CreateVehicleDto.prototype, "description", void 0);
_ts_decorate([
    IsOptional(),
    IsString(),
    MaxLength(120),
    Transform(({ value })=>typeof value === 'string' ? value.trim() : value),
    _ts_metadata("design:type", String)
], CreateVehicleDto.prototype, "engine", void 0);
_ts_decorate([
    IsOptional(),
    IsInt(),
    Min(1),
    _ts_metadata("design:type", Number)
], CreateVehicleDto.prototype, "torqueNm", void 0);
_ts_decorate([
    IsOptional(),
    IsNumber({
        maxDecimalPlaces: 1
    }),
    Min(0.1),
    _ts_metadata("design:type", Number)
], CreateVehicleDto.prototype, "acceleration0To100", void 0);
_ts_decorate([
    IsOptional(),
    IsInt(),
    Min(1),
    _ts_metadata("design:type", Number)
], CreateVehicleDto.prototype, "topSpeedKmh", void 0);
_ts_decorate([
    IsOptional(),
    IsNumber({
        maxDecimalPlaces: 1
    }),
    Min(0.1),
    _ts_metadata("design:type", Number)
], CreateVehicleDto.prototype, "consumptionL100km", void 0);
_ts_decorate([
    IsOptional(),
    IsBoolean(),
    _ts_metadata("design:type", Boolean)
], CreateVehicleDto.prototype, "isSpecial", void 0);
_ts_decorate([
    IsOptional(),
    IsBoolean(),
    _ts_metadata("design:type", Boolean)
], CreateVehicleDto.prototype, "isLimited", void 0);
_ts_decorate([
    IsOptional(),
    IsInt(),
    Min(1),
    _ts_metadata("design:type", Number)
], CreateVehicleDto.prototype, "editionSize", void 0);

//# sourceMappingURL=create-vehicle.dto.js.map