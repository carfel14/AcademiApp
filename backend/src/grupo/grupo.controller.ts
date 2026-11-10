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
import { GrupoService } from './grupo.service';
import { CreateGrupoDto } from './dto/create-grupo.dto';
import { UpdateGrupoDto } from './dto/update_grupo.dto';

@Controller('grupos')
export class GrupoController {
  constructor(private readonly grupoService: GrupoService) {}

  @Get()
  getGrupos() {
    return this.grupoService.getGrupos();
  }

  @Get(':id')
  getGrupo(@Param('id', ParseIntPipe) id: number) {
    return this.grupoService.getGrupo(id);
  }

  @Post()
  createGrupo(@Body() grupo: CreateGrupoDto) {
    return this.grupoService.createGrupo(grupo);
  }

  @Patch(':id')
  updateGrupo(
    @Param('id', ParseIntPipe) id: number,
    @Body() grupo: UpdateGrupoDto,
  ) {
    return this.grupoService.updateGrupo(id, grupo);
  }

  @Patch(':id/finalizar')
  finalizarGrupo(@Param('id', ParseIntPipe) id: number) {
    return this.grupoService.finalizarGrupo(id);
  }

  @Delete(':id')
  deleteGrupo(@Param('id', ParseIntPipe) id: number) {
    return this.grupoService.deleteGrupo(id);
  }
}
