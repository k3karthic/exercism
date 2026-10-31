package com.github.k3karthic.durableexecution.temporal.activity

import kotlin.random.Random

class DoublerActivityImpl : DoublerActivityInterface {
    override fun getRandomNumber(): Double = Random.nextDouble()

    override fun doubleNumber(number: Double): Double = number * number
}
