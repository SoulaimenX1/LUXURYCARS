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
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { VehicleStatus } from '../entities/vehicle.entity.js';
// Ce DTO contient les informations
// qu'un administrateur peut modifier.
//
// Tous les champs sont facultatifs :
// il suffit d'envoyer ceux que l'on veut modifier.
export class UpdateVehicleDto {
}
_ts_decorate([
    IsOptional(),
    IsNumber({
        maxDecimalPlaces: 2
    }),
    Min(0.01),
    _ts_metadata("design:type", Number)
], UpdateVehicleDto.prototype, "dailyPrice", void 0);
_ts_decorate([
    IsOptional(),
    IsNumber({
        maxDecimalPlaces: 2
    }),
    Min(0),
    _ts_metadata("design:type", Number)
], UpdateVehicleDto.prototype, "securityDeposit", void 0);
_ts_decorate([
    IsOptional(),
    IsInt(),
    Min(0),
    _ts_metadata("design:type", Number)
], UpdateVehicleDto.prototype, "mileageKm", void 0);
_ts_decorate([
    IsOptional(),
    IsEnum(VehicleStatus),
    _ts_metadata("design:type", typeof VehicleStatus === "undefined" ? Object : VehicleStatus)
], UpdateVehicleDto.prototype, "status", void 0);
_ts_decorate([
    IsOptional(),
    IsString(),
    MaxLength(40),
    Transform(({ value })=>typeof value === 'string' ? value.trim() : value),
    _ts_metadata("design:type", Object)
], UpdateVehicleDto.prototype, "color", void 0);
_ts_decorate([
    IsOptional(),
    IsString(),
    Transform(({ value })=>typeof value === 'string' ? value.trim() : value),
    _ts_metadata("design:type", Object)
], UpdateVehicleDto.prototype, "description", void 0);
_ts_decorate([
    IsOptional(),
    IsString(),
    MaxLength(120),
    Transform(({ value })=>typeof value === 'string' ? value.trim() : value),
    _ts_metadata("design:type", Object)
], UpdateVehicleDto.prototype, "engine", void 0);
_ts_decorate([
    IsOptional(),
    IsInt(),
    Min(1),
    _ts_metadata("design:type", Object)
], UpdateVehicleDto.prototype, "torqueNm", void 0);
_ts_decorate([
    IsOptional(),
    IsNumber({
        maxDecimalPlaces: 1
    }),
    Min(0.1),
    _ts_metadata("design:type", Object)
], UpdateVehicleDto.prototype, "acceleration0To100", void 0);
_ts_decorate([
    IsOptional(),
    IsInt(),
    Min(1),
    _ts_metadata("design:type", Object)
], UpdateVehicleDto.prototype, "topSpeedKmh", void 0);
_ts_decorate([
    IsOptional(),
    IsNumber({
        maxDecimalPlaces: 1
    }),
    Min(0.1),
    _ts_metadata("design:type", Object)
], UpdateVehicleDto.prototype, "consumptionL100km", void 0);
_ts_decorate([
    IsOptional(),
    IsBoolean(),
    _ts_metadata("design:type", Boolean)
], UpdateVehicleDto.prototype, "isSpecial", void 0);
_ts_decorate([
    IsOptional(),
    IsBoolean(),
    _ts_metadata("design:type", Boolean)
], UpdateVehicleDto.prototype, "isLimited", void 0);
_ts_decorate([
    IsOptional(),
    IsInt(),
    Min(1),
    _ts_metadata("design:type", Object)
], UpdateVehicleDto.prototype, "editionSize", void 0);

//# sourceMappingURL=update-vehicle.dto.js.map