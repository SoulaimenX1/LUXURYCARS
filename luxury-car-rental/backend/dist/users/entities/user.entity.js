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
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
export var UserRole = /*#__PURE__*/ function(UserRole) {
    UserRole["CUSTOMER"] = "customer";
    UserRole["STAFF"] = "staff";
    UserRole["ADMIN"] = "admin";
    return UserRole;
}({});
export var AccountStatus = /*#__PURE__*/ function(AccountStatus) {
    AccountStatus["INVITED"] = "invited";
    AccountStatus["ACTIVE"] = "active";
    AccountStatus["SUSPENDED"] = "suspended";
    return AccountStatus;
}({});
export class User {
}
_ts_decorate([
    PrimaryColumn({
        type: 'uuid',
        default: ()=>'gen_random_uuid()'
    }),
    _ts_metadata("design:type", String)
], User.prototype, "id", void 0);
_ts_decorate([
    Column({
        type: 'citext',
        unique: true
    }),
    _ts_metadata("design:type", String)
], User.prototype, "email", void 0);
_ts_decorate([
    Column({
        name: 'password_hash',
        type: 'text',
        nullable: true,
        select: false
    }),
    _ts_metadata("design:type", Object)
], User.prototype, "passwordHash", void 0);
_ts_decorate([
    Column({
        type: 'enum',
        enum: UserRole,
        enumName: 'user_role',
        default: "customer"
    }),
    _ts_metadata("design:type", String)
], User.prototype, "role", void 0);
_ts_decorate([
    Column({
        type: 'enum',
        enum: AccountStatus,
        enumName: 'account_status',
        default: "active"
    }),
    _ts_metadata("design:type", String)
], User.prototype, "status", void 0);
_ts_decorate([
    Column({
        name: 'first_name',
        type: 'varchar',
        length: 100
    }),
    _ts_metadata("design:type", String)
], User.prototype, "firstName", void 0);
_ts_decorate([
    Column({
        name: 'last_name',
        type: 'varchar',
        length: 100
    }),
    _ts_metadata("design:type", String)
], User.prototype, "lastName", void 0);
_ts_decorate([
    Column({
        type: 'varchar',
        length: 30,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], User.prototype, "phone", void 0);
_ts_decorate([
    Column({
        name: 'email_verified_at',
        type: 'timestamptz',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], User.prototype, "emailVerifiedAt", void 0);
_ts_decorate([
    Column({
        name: 'last_login_at',
        type: 'timestamptz',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], User.prototype, "lastLoginAt", void 0);
_ts_decorate([
    CreateDateColumn({
        name: 'created_at',
        type: 'timestamptz'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], User.prototype, "createdAt", void 0);
_ts_decorate([
    UpdateDateColumn({
        name: 'updated_at',
        type: 'timestamptz'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], User.prototype, "updatedAt", void 0);
User = _ts_decorate([
    Entity('users')
], User);

//# sourceMappingURL=user.entity.js.map