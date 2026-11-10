import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { HorarioClaseService } from './horario-clase.service';
import { CreateHorarioDto } from './dto/create-horario.dto';
import { UpdateHorarioDto } from './dto/update-horario.dto';

@Controller()
export class HorarioClaseController {
  constructor(private readonly horarioClaseService: HorarioClaseService) {}

  //Queremos ver los horarios de un determinado grupo,
  // listar todos los registros de horario no seria una informacion Ãºtil.
  // Por eso grupos/:idGrupo/horarios
  @Get('grupos/:idGrupo/horarios')
  getHorariosPorGrupo(@Param('idGrupo', ParseIntPipe) idGrupo: number) {
    return this.horarioClaseService.getHorariosPorGrupo(idGrupo);
  }

  //El id_grupo no se manda, se toma de la URL
  @Post('grupos/:idGrupo/horarios')
  createHorario(
    @Param('idGrupo', ParseIntPipe) idGrupo: number,
    @Body() horario: CreateHorarioDto,
  ) {
    return this.horarioClaseService.createHorario(idGrupo, horario);
  }

  //Para tomar el registro de un horario especÃ­fico
  @Get('horarios/:id')
  getHorario(@Param('id', ParseIntPipe) id: number) {
    return this.horarioClaseService.getHorario(id);
  }

  @Patch('horarios/:id')
  updateHorario(
    @Param('id', ParseIntPipe) id: number,
    @Body() horario: UpdateHorarioDto,
  ) {
    return this.horarioClaseService.updateHorario(id, horario);
  }

  @Delete('horarios/:id')
  deleteHorario(@Param('id', ParseIntPipe) id: number) {
    return this.horarioClaseService.deleteHorario(id);
  }
}

//Tenemos dos tipos de rutas.
// El primero trabaja con el grupo como contexto y el segundo trabaja directamente con el horario.
