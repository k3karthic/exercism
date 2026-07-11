package com.github.k3karthic.durableexecution.temporal.activity

import io.temporal.activity.ActivityInterface
import io.temporal.activity.ActivityMethod

@ActivityInterface
interface DoublerActivityInterface {
    @ActivityMethod
    fun getRandomNumber(): Double

    @ActivityMethod
    fun doubleNumber(number: Double): Double
}
