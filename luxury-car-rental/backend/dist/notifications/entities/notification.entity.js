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
// Types de notifications affichées sur le site.
// Ils correspondent à l'ENUM PostgreSQL
// notification_type.
export var NotificationType = /*#__PURE__*/ function(NotificationType) {
    NotificationType["NEW_VEHICLE"] = "new_vehicle";
    NotificationType["SPECIAL_EDITION"] = "special_edition";
    NotificationType["LIMITED_EDITION"] = "limited_edition";
    NotificationType["GENERAL"] = "general";
    return NotificationType;
}({});
export class Notification {
}
_ts_decorate([
    PrimaryColumn({
        type: 'uuid',
        default: ()=>'gen_random_uuid()'
    }),
    _ts_metadata("design:type", String)
], Notification.prototype, "id", void 0);
_ts_decorate([
    Column({
        name: 'type',
        type: 'enum',
        enum: NotificationType,
        enumName: 'notification_type',
        default: "general"
    }),
    _ts_metadata("design:type", String)
], Notification.prototype, "type", void 0);
_ts_decorate([
    Column({
        name: 'title',
        type: 'varchar',
        length: 160
    }),
    _ts_metadata("design:type", String)
], Notification.prototype, "title", void 0);
_ts_decorate([
    Column({
        name: 'message',
        type: 'text',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], Notification.prototype, "message", void 0);
_ts_decorate([
    Column({
        name: 'vehicle_id',
        type: 'uuid',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], Notification.prototype, "vehicleId", void 0);
_ts_decorate([
    Column({
        name: 'is_published',
        type: 'boolean',
        default: true
    }),
    _ts_metadata("design:type", Boolean)
], Notification.prototype, "isPublished", void 0);
_ts_decorate([
    Column({
        name: 'created_at',
        type: 'timestamptz',
        default: ()=>'now()'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], Notification.prototype, "createdAt", void 0);
Notification = _ts_decorate([
    Entity('notifications')
], Notification);

//# sourceMappingURL=notification.entity.js.map