from pydantic import BaseModel, Field


class PlantCareInfo(BaseModel):
    light: str = Field(
        description="Кратко (до 25-30 символов), например: Яркий рассеянный"
    )
    watering: str = Field(
        description="Кратко (до 25-30 символов), например: Раз в 5–7 дней"
    )
    temperature: str = Field(
        description="Кратко (до 25-30 символов), например: +18…+25 °C"
    )
    humidity: str = Field(
        description="Кратко (до 25-30 символов), например: Умеренная, 50–60%"
    )
    care_complexity: str = Field(
        description=(
            "Словесная оценка без цифр (до 25-30 символов, без точки в конце), "
            "например: Неприхотливое, Среднее, Капризное"
        )
    )
    complexity_rate: int = Field(
        ge=0,
        le=5,
        description="Оценка сложности ухода от 0 (очень легкое) до 5 (очень сложное)",
    )
    is_toxic: bool = Field(description="Токсично ли растение для людей или животных")
    toxicity_note: str = Field(
        description=(
            "Короткий вывод (до 25-30 символов, без точки в конце), "
            "например: Токсично для питомцев, Безопасно"
        )
    )


class PlantAnalysisResponse(BaseModel):
    data: PlantCareInfo
    message: str = Field(
        description="Полный структурированный разбор растения в формате Markdown"
    )


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
    data: PlantCareInfo | None = None
    reply: str
