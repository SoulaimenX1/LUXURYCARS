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
import { IsEmail, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
export class RegisterDto {
}
_ts_decorate([
    IsString(),
    Length(2, 100),
    Transform(({ value })=>typeof value === 'string' ? value.trim() : value),
    _ts_metadata("design:type", String)
], RegisterDto.prototype, "firstName", void 0);
_ts_decorate([
    IsString(),
    Length(2, 100),
    Transform(({ value })=>typeof value === 'string' ? value.trim() : value),
    _ts_metadata("design:type", String)
], RegisterDto.prototype, "lastName", void 0);
_ts_decorate([
    IsEmail(),
    Transform(({ value })=>typeof value === 'string' ? value.trim().toLowerCase() : value),
    _ts_metadata("design:type", String)
], RegisterDto.prototype, "email", void 0);
_ts_decorate([
    IsString(),
    MinLength(12),
    MaxLength(128),
    _ts_metadata("design:type", String)
], RegisterDto.prototype, "password", void 0);
_ts_decorate([
    IsOptional(),
    IsString(),
    MaxLength(30),
    _ts_metadata("design:type", String)
], RegisterDto.prototype, "phone", void 0);

//# sourceMappingURL=register.dto.js.map