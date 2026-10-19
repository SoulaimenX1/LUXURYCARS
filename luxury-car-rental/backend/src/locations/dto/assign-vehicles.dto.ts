import {
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
  IsUUID,
} from 'class-validator';

// Affectation d'un lieu de service à une liste de véhicules précis.
export class AssignVehiclesDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  vehicleIds!: string[];
}
