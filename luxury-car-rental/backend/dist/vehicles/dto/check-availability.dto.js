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
import { IsString, Matches } from 'class-validator';
// Ce DTO vérifie les deux dates
// envoyées dans les paramètres de l'URL.
export class CheckAvailabilityDto {
}
_ts_decorate([
    IsString(),
    Matches(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'from must use YYYY-MM-DD format'
    }),
    _ts_metadata("design:type", String)
], CheckAvailabilityDto.prototype, "from", void 0);
_ts_decorate([
    IsString(),
    Matches(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'to must use YYYY-MM-DD format'
    }),
    _ts_metadata("design:type", String)
], CheckAvailabilityDto.prototype, "to", void 0);

//# sourceMappingURL=check-availability.dto.js.map