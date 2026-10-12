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
import { Column, Entity, PrimaryColumn } from 'typeorm';
// ==========================================================
// TYPE DE MÉDIA
// ==========================================================
//
// Une ligne de `vehicle_images` décrit soit une photo, soit
// une vidéo. La valeur correspond à l'ENUM PostgreSQL
// `media_type`.
export var MediaType = /*#__PURE__*/ function(MediaType) {
    MediaType["IMAGE"] = "image";
    MediaType["VIDEO"] = "video";
    return MediaType;
}({});
export class VehicleImage {
}
_ts_decorate([
    PrimaryColumn({
        type: 'uuid',
        default: ()=>'gen_random_uuid()'
    }),
    _ts_metadata("design:type", String)
], VehicleImage.prototype, "id", void 0);
_ts_decorate([
    Column({
        name: 'vehicle_id',
        type: 'uuid'
    }),
    _ts_metadata("design:type", String)
], VehicleImage.prototype, "vehicleId", void 0);
_ts_decorate([
    Column({
        name: 'storage_path',
        type: 'text'
    }),
    _ts_metadata("design:type", String)
], VehicleImage.prototype, "storagePath", void 0);
_ts_decorate([
    Column({
        name: 'media_type',
        type: 'enum',
        enum: MediaType,
        enumName: 'media_type',
        default: "image"
    }),
    _ts_metadata("design:type", String)
], VehicleImage.prototype, "mediaType", void 0);
_ts_decorate([
    Column({
        name: 'poster_path',
        type: 'text',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], VehicleImage.prototype, "posterPath", void 0);
_ts_decorate([
    Column({
        name: 'alt_text',
        type: 'varchar',
        length: 255,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], VehicleImage.prototype, "altText", void 0);
_ts_decorate([
    Column({
        name: 'is_primary',
        type: 'boolean',
        default: false
    }),
    _ts_metadata("design:type", Boolean)
], VehicleImage.prototype, "isPrimary", void 0);
_ts_decorate([
    Column({
        name: 'sort_order',
        type: 'smallint',
        default: 0
    }),
    _ts_metadata("design:type", Number)
], VehicleImage.prototype, "sortOrder", void 0);
_ts_decorate([
    Column({
        name: 'created_at',
        type: 'timestamptz',
        default: ()=>'now()'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], VehicleImage.prototype, "createdAt", void 0);
VehicleImage = _ts_decorate([
    Entity('vehicle_images')
], VehicleImage);

//# sourceMappingURL=vehicle-image.entity.js.map