import re
from typing import Literal
from pydantic import BaseModel, Field, model_validator


class Criterion(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(max_length=120)
    desc: str = Field(max_length=1000)
    scope: Literal['all', 'own', 'competitor'] = 'all'
    mode: Literal['auto', 'prompt'] = 'auto'
    weight: int | None = Field(default=1, ge=1, le=10)
    type: Literal['base', 'custom'] = 'custom'


class Phone(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    number: str = Field(max_length=40)
    label: str = Field(default='', max_length=120)
    kind: str = Field(default='Sin especificar', max_length=80)


class Company(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(max_length=120)
    phones: list[Phone] = Field(max_length=10)


class CampaignInput(BaseModel):
    id: str = Field(pattern=r'^[a-zA-Z0-9_-]{1,80}$')
    name: str = Field(max_length=160)
    sector: str = Field(default='', max_length=160)
    offer: str = Field(default='', max_length=300)
    sample: int = Field(default=2, ge=1, le=10)
    date: str = Field(default='', max_length=80)
    own: Company
    competitors: list[Company] = Field(default_factory=list, max_length=10)
    criteria: list[Criterion] = Field(max_length=30)
    scenarios: list[Literal['price', 'recommend', 'object', 'compare']] = Field(max_length=4)

    @model_validator(mode='after')
    def unique_ids(self):
        companies = [self.own, *self.competitors]
        for ids in ([c.id for c in companies], [c.id for c in self.criteria], self.scenarios):
            if len(ids) != len(set(ids)):
                raise ValueError('Los identificadores y escenarios deben ser únicos')
        if self.own.id != 'own':
            raise ValueError('El canal propio debe tener id own')
        for c in companies:
            ids = [p.id for p in c.phones]
            if len(ids) != len(set(ids)):
                raise ValueError('Identificadores de números duplicados')
        return self

    def validate_run(self):
        if not all(x.strip() for x in [self.name, self.sector, self.offer]):
            raise ValueError('Completa nombre, sector y oferta')
        if not self.criteria or not self.scenarios:
            raise ValueError('Incluye criterios y escenarios')
        if any(not c.name.strip() or not c.desc.strip() for c in self.criteria):
            raise ValueError('Completa los criterios')
        count = 0
        for co in [self.own, *self.competitors]:
            if not co.name.strip() or not co.phones:
                raise ValueError('Cada empresa necesita nombre y números')
            numbers = []
            for p in co.phones:
                digits = re.sub(r'\D', '', p.number)
                if not re.fullmatch(r'\+?[\d .()-]+', p.number) or not 7 <= len(digits) <= 15:
                    raise ValueError('Número inválido')
                numbers.append(digits)
            if len(set(numbers)) != len(numbers):
                raise ValueError('Números duplicados')
            count += len(numbers)
        if count * len(self.scenarios) * self.sample > 1000:
            raise ValueError('Máximo 1000 pruebas por campaña')
