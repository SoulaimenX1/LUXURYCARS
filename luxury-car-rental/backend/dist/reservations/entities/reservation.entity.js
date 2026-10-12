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
// Statuts possibles d'une réservation.
// Les valeurs correspondent à l'ENUM
// reservation_status de PostgreSQL.
export var ReservationStatus = /*#__PURE__*/ function(ReservationStatus) {
    ReservationStatus["PENDING"] = "pending";
    ReservationStatus["CONFIRMED"] = "confirmed";
    ReservationStatus["REJECTED"] = "rejected";
    ReservationStatus["CANCELLED"] = "cancelled";
    ReservationStatus["EXPIRED"] = "expired";
    ReservationStatus["CONVERTED"] = "converted";
    return ReservationStatus;
}({});
export class Reservation {
}
_ts_decorate([
    PrimaryColumn({
        type: 'uuid',
        default: ()=>'gen_random_uuid()'
    }),
    _ts_metadata("design:type", String)
], Reservation.prototype, "id", void 0);
_ts_decorate([
    Column({
        name: 'reservation_number',
        type: 'varchar',
        length: 20,
        insert: false,
        update: false
    }),
    _ts_metadata("design:type", String)
], Reservation.prototype, "reservationNumber", void 0);
_ts_decorate([
    Column({
        name: 'customer_id',
        type: 'uuid'
    }),
    _ts_metadata("design:type", String)
], Reservation.prototype, "customerId", void 0);
_ts_decorate([
    Column({
        name: 'vehicle_id',
        type: 'uuid'
    }),
    _ts_metadata("design:type", String)
], Reservation.prototype, "vehicleId", void 0);
_ts_decorate([
    Column({
        name: 'pickup_at',
        type: 'timestamptz'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], Reservation.prototype, "pickupAt", void 0);
_ts_decorate([
    Column({
        name: 'return_at',
        type: 'timestamptz'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], Reservation.prototype, "returnAt", void 0);
_ts_decorate([
    Column({
        name: 'rental_days',
        type: 'integer'
    }),
    _ts_metadata("design:type", Number)
], Reservation.prototype, "rentalDays", void 0);
_ts_decorate([
    Column({
        name: 'daily_price',
        type: 'numeric',
        precision: 10,
        scale: 2
    }),
    _ts_metadata("design:type", String)
], Reservation.prototype, "dailyPrice", void 0);
_ts_decorate([
    Column({
        name: 'deposit_amount',
        type: 'numeric',
        precision: 10,
        scale: 2
    }),
    _ts_metadata("design:type", String)
], Reservation.prototype, "depositAmount", void 0);
_ts_decorate([
    Column({
        name: 'total_amount',
        type: 'numeric',
        precision: 12,
        scale: 2
    }),
    _ts_metadata("design:type", String)
], Reservation.prototype, "totalAmount", void 0);
_ts_decorate([
    Column({
        name: 'status',
        type: 'enum',
        enum: ReservationStatus,
        enumName: 'reservation_status',
        default: "pending"
    }),
    _ts_metadata("design:type", String)
], Reservation.prototype, "status", void 0);
_ts_decorate([
    Column({
        name: 'customer_notes',
        type: 'text',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], Reservation.prototype, "customerNotes", void 0);
_ts_decorate([
    Column({
        name: 'decided_by',
        type: 'uuid',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], Reservation.prototype, "decidedBy", void 0);
_ts_decorate([
    Column({
        name: 'decided_at',
        type: 'timestamptz',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], Reservation.prototype, "decidedAt", void 0);
_ts_decorate([
    Column({
        name: 'decision_reason',
        type: 'text',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], Reservation.prototype, "decisionReason", void 0);
_ts_decorate([
    Column({
        name: 'created_at',
        type: 'timestamptz',
        default: ()=>'now()'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], Reservation.prototype, "createdAt", void 0);
_ts_decorate([
    Column({
        name: 'updated_at',
        type: 'timestamptz',
        default: ()=>'now()'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], Reservation.prototype, "updatedAt", void 0);
Reservation = _ts_decorate([
    Entity('reservations')
], Reservation);

//# sourceMappingURL=reservation.entity.js.map