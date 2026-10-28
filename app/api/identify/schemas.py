
from pydantic import BaseModel, Field


class PlantSpecies(BaseModel):    
    scientific_name: str = Field(alias="scientificNameWithoutAuthor", default="Неизвестный вид")
    family: dict = Field(default_factory=dict)
    common_names: list[str] = Field(alias="commonNames", default_factory=list)

    @property
    def family_name(self) -> str:
        return self.family.get("scientificNameWithoutAuthor", "Неизвестное семейство")


class PlantNetResultItem(BaseModel):
    score: float = 0.0
    species: PlantSpecies = Field(default_factory=PlantSpecies)


class PlantNetResponse(BaseModel):
    best_match: str | None = Field(alias="bestMatch", default=None)
    results: list[PlantNetResultItem] = Field(default_factory=list)

    @property
    def best_result(self) -> PlantNetResultItem | None:
        if self.results:
            return self.results[0]
        return None