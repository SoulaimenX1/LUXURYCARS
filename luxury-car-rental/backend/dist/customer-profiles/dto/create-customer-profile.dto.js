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
// Ce DTO vérifie les informations
// envoyées par le client.
export class CreateCustomerProfileDto {
}
_ts_decorate([
    IsString(),
    Matches(/^\d{4}-\d{2}-\d{2}$/),
    _ts_metadata("design:type", String)
], CreateCustomerProfileDto.prototype, "dateOfBirth", void 0);
_ts_decorate([
    IsOptional(),
    IsString(),
    MaxLength(255),
    _ts_metadata("design:type", String)
], CreateCustomerProfileDto.prototype, "addressLine", void 0);
_ts_decorate([
    IsOptional(),
    IsString(),
    MaxLength(100),
    _ts_metadata("design:type", String)
], CreateCustomerProfileDto.prototype, "city", void 0);
_ts_decorate([
    IsOptional(),
    IsString(),
    MaxLength(20),
    _ts_metadata("design:type", String)
], CreateCustomerProfileDto.prototype, "postalCode", void 0);
_ts_decorate([
    IsOptional(),
    IsString(),
    Matches(/^[A-Z]{2}$/),
    Transform(({ value })=>typeof value === 'string' ? value.trim().toUpperCase() : value),
    _ts_metadata("design:type", String)
], CreateCustomerProfileDto.prototype, "country", void 0);
_ts_decorate([
    IsString(),
    Length(1, 50),
    Transform(({ value })=>typeof value === 'string' ? value.trim() : value),
    _ts_metadata("design:type", String)
], CreateCustomerProfileDto.prototype, "licenseNumber", void 0);
_ts_decorate([
    IsString(),
    Matches(/^[A-Z]{2}$/),
    Transform(({ value })=>typeof value === 'string' ? value.trim().toUpperCase() : value),
    _ts_metadata("design:type", String)
], CreateCustomerProfileDto.prototype, "licenseCountry", void 0);
_ts_decorate([
    IsString(),
    Matches(/^\d{4}-\d{2}-\d{2}$/),
    _ts_metadata("design:type", String)
], CreateCustomerProfileDto.prototype, "licenseIssuedOn", void 0);
_ts_decorate([
    IsString(),
    Matches(/^\d{4}-\d{2}-\d{2}$/),
    _ts_metadata("design:type", String)
], CreateCustomerProfileDto.prototype, "licenseExpiresOn", void 0);

//# sourceMappingURL=create-customer-profile.dto.js.map