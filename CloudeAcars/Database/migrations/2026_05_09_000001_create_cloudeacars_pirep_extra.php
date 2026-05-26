<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateCloudeacarsPirepExtra extends Migration
{
    public function up()
    {
        Schema::create('cloudeacars_pirep_extra', function (Blueprint $table) {
            $table->id();
            $table->string('pirep_id');
            $table->float('landing_fpm')->nullable();
            $table->float('touchdown_g')->nullable();
            $table->decimal('landing_lat', 10, 6)->nullable();
            $table->decimal('landing_lon', 10, 6)->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('cloudeacars_pirep_extra');
    }
}
