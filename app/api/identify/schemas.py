from pydantic import BaseModel, Field


class PlantSpecies(BaseModel):
    scientific_name: str = Field(
        alias="scientificNameWithoutAuthor", default="Неизвестный вид"
    )
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

    @property
    def scientific_name(self) -> str:
        if self.best_result:
            return self.best_result.species.scientific_name
        return self.best_match or "Неизвестный вид"

    @property
    def family_name(self) -> str:
        if self.best_result:
            return self.best_result.species.family_name
        return "Неизвестное семейство"

    @property
    def common_names_str(self) -> str:
        if self.best_result and self.best_result.species.common_names:
            return ", ".join(self.best_result.species.common_names)
        return "Не указаны"

    @property
    def context_str(self) -> str:
        return f"{self.scientific_name} ({self.family_name})"


class PlantIdentifyResponse(BaseModel):
    chat_id: str
    scientific_name: str
    family_name: str
    common_names: list[str] = Field(default_factory=list)
    confidence: float
    reply: str
