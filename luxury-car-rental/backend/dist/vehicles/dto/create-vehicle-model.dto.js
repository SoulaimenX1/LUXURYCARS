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
import { IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';
// Données nécessaires pour créer un modèle automobile.
// L'administrateur utilise les noms au lieu des UUID.
export class CreateVehicleModelDto {
}
_ts_decorate([
    IsString(),
    Length(2, 100),
    Transform(({ value })=>typeof value === 'string' ? value.trim() : value),
    _ts_metadata("design:type", String)
], CreateVehicleModelDto.prototype, "brandName", void 0);
_ts_decorate([
    IsString(),
    Length(2, 50),
    Transform(({ value })=>typeof value === 'string' ? value.trim() : value),
    _ts_metadata("design:type", String)
], CreateVehicleModelDto.prototype, "categoryName", void 0);
_ts_decorate([
    IsString(),
    Length(2, 100),
    Transform(({ value })=>typeof value === 'string' ? value.trim() : value),
    _ts_metadata("design:type", String)
], CreateVehicleModelDto.prototype, "name", void 0);

//# sourceMappingURL=create-vehicle-model.dto.js.map