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
import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
// Ce DTO définit les informations
// envoyées par le client pour réserver
// une voiture de luxe.
export class CreateReservationDto {
}
_ts_decorate([
    IsString(),
    Length(2, 80),
    Transform(({ value })=>typeof value === 'string' ? value.trim() : value),
    _ts_metadata("design:type", String)
], CreateReservationDto.prototype, "brandName", void 0);
_ts_decorate([
    IsString(),
    Length(2, 100),
    Transform(({ value })=>typeof value === 'string' ? value.trim() : value),
    _ts_metadata("design:type", String)
], CreateReservationDto.prototype, "modelName", void 0);
_ts_decorate([
    IsString(),
    Matches(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'pickupDate must use YYYY-MM-DD format'
    }),
    _ts_metadata("design:type", String)
], CreateReservationDto.prototype, "pickupDate", void 0);
_ts_decorate([
    IsString(),
    Matches(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'returnDate must use YYYY-MM-DD format'
    }),
    _ts_metadata("design:type", String)
], CreateReservationDto.prototype, "returnDate", void 0);
_ts_decorate([
    IsOptional(),
    IsString(),
    MaxLength(1000),
    Transform(({ value })=>typeof value === 'string' ? value.trim() : value),
    _ts_metadata("design:type", String)
], CreateReservationDto.prototype, "customerNotes", void 0);

//# sourceMappingURL=create-reservation.dto.js.map