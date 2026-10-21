"""Bounded wire models. All planning times are minutes in the chosen service day."""
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

Number = Annotated[float, Field(ge=0, le=10_000_000, allow_inf_nan=False)]
Minute = Annotated[int, Field(ge=0, le=1440)]
Identifier = Annotated[str, Field(pattern=r'^[A-Za-z0-9_-]{1,50}$')]


class Model(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)


class Point(Model):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    name: str = Field(min_length=1, max_length=120)


class Vehicle(Model):
    id: Identifier
    driver: str = Field(min_length=1, max_length=80)
    payloadKg: float = Field(gt=0, le=1000)
    volumeM3: float = Field(gt=0, le=20)
    start: Minute
    end: Minute

    @model_validator(mode='after')
    def shift(self):
        if self.start >= self.end:
            raise ValueError('Ca xe phải kết thúc sau giờ bắt đầu trong cùng ngày.')
        return self


class Station(Point):
    id: Identifier
    massKg: Number
    volumeM3: float = Field(gt=0, le=20)
    fillPct: float = Field(ge=0, le=200)
    forecastPct: float = Field(ge=0, le=200)
    open: Minute
    close: Minute

    @model_validator(mode='after')
    def window(self):
        if self.open >= self.close:
            raise ValueError('Khung giờ trạm phải nằm trong cùng ngày.')
        return self


class Ban(Model):
    start: Minute
    end: Minute

    @model_validator(mode='after')
    def ordered(self):
        if self.start >= self.end:
            raise ValueError('Giờ cấm kết thúc phải sau giờ bắt đầu.')
        return self


class OptimizeRequest(Model):
    vehicles: list[Vehicle] = Field(min_length=1, max_length=10)
    stations: list[Station] = Field(min_length=1, max_length=30)
    depot: Point
    destination: Point
    # Both matrices are ordered: depot, stations in request order, destination.
    distancesM: list[list[Number | None]] = Field(max_length=32)
    durationsS: list[list[Number | None]] = Field(max_length=32)
    provider: Literal['valhalla', 'osrm', 'estimate']
    serviceMin: int = Field(default=8, ge=1, le=120)
    thresholdPct: float = Field(default=80, ge=60, le=94)
    stopPct: float = Field(default=95, ge=95, le=100)
    includeNearby: bool = True
    maxDetourKm: float = Field(default=2, ge=0, le=10)
    drivingBans: list[Ban] = Field(default_factory=list, max_length=4)

    @model_validator(mode='after')
    def consistency(self):
        n = len(self.stations) + 2
        for matrix in (self.distancesM, self.durationsS):
            if len(matrix) != n or any(len(row) != n for row in matrix):
                raise ValueError('Kích thước ma trận không khớp các điểm.')
            if any(matrix[i][i] != 0 for i in range(n)):
                raise ValueError('Đường chéo ma trận phải bằng 0.')
        if len({s.id for s in self.stations}) != len(self.stations):
            raise ValueError('Mã trạm bị trùng.')
        if len({v.id for v in self.vehicles}) != len(self.vehicles):
            raise ValueError('Mã xe bị trùng.')
        return self


class Position(Model):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    accuracy: float = Field(ge=0, le=10000)
    heading: float | None = Field(default=None, ge=0, lt=360)
    speed: float | None = Field(default=None, ge=0, le=100)
    recordedAt: float = Field(gt=0)


class DispatchRequest(Model):
    planId: str = Field(min_length=1, max_length=80)
    revision: int = Field(ge=0)


class DriverAction(Model):
    action: Literal['start', 'stop', 'finish', 'collected']
    stationId: Identifier | None = None
