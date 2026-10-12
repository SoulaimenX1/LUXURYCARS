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
export class Category {
}
_ts_decorate([
    PrimaryColumn({
        type: 'uuid',
        default: ()=>'gen_random_uuid()'
    }),
    _ts_metadata("design:type", String)
], Category.prototype, "id", void 0);
_ts_decorate([
    Column({
        type: 'varchar'
    }),
    _ts_metadata("design:type", String)
], Category.prototype, "name", void 0);
_ts_decorate([
    Column({
        type: 'text',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], Category.prototype, "description", void 0);
Category = _ts_decorate([
    Entity('categories')
], Category);

//# sourceMappingURL=category.entity.js.map