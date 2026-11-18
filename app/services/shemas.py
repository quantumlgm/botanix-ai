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
