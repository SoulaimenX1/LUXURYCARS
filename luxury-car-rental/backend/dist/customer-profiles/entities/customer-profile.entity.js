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
export class CustomerProfile {
}
_ts_decorate([
    PrimaryColumn({
        name: 'user_id',
        type: 'uuid'
    }),
    _ts_metadata("design:type", String)
], CustomerProfile.prototype, "userId", void 0);
_ts_decorate([
    Column({
        name: 'date_of_birth',
        type: 'date'
    }),
    _ts_metadata("design:type", String)
], CustomerProfile.prototype, "dateOfBirth", void 0);
_ts_decorate([
    Column({
        name: 'address_line',
        type: 'varchar',
        length: 255,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], CustomerProfile.prototype, "addressLine", void 0);
_ts_decorate([
    Column({
        name: 'city',
        type: 'varchar',
        length: 100,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], CustomerProfile.prototype, "city", void 0);
_ts_decorate([
    Column({
        name: 'postal_code',
        type: 'varchar',
        length: 20,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], CustomerProfile.prototype, "postalCode", void 0);
_ts_decorate([
    Column({
        name: 'country',
        type: 'char',
        length: 2,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], CustomerProfile.prototype, "country", void 0);
_ts_decorate([
    Column({
        name: 'license_number',
        type: 'varchar',
        length: 50
    }),
    _ts_metadata("design:type", String)
], CustomerProfile.prototype, "licenseNumber", void 0);
_ts_decorate([
    Column({
        name: 'license_country',
        type: 'char',
        length: 2
    }),
    _ts_metadata("design:type", String)
], CustomerProfile.prototype, "licenseCountry", void 0);
_ts_decorate([
    Column({
        name: 'license_issued_on',
        type: 'date'
    }),
    _ts_metadata("design:type", String)
], CustomerProfile.prototype, "licenseIssuedOn", void 0);
_ts_decorate([
    Column({
        name: 'license_expires_on',
        type: 'date'
    }),
    _ts_metadata("design:type", String)
], CustomerProfile.prototype, "licenseExpiresOn", void 0);
CustomerProfile = _ts_decorate([
    Entity('customer_profiles')
], CustomerProfile);

//# sourceMappingURL=customer-profile.entity.js.map